import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  HANDLE_REGEX,
  LIMITS,
  type BioLink,
  type BioProfile,
  type SocialPlatformKey,
  type SocialsMap,
  type UserAccount,
} from '../types/bio';

const ALLOWED_SOCIAL_KEYS: SocialPlatformKey[] = [
  'tiktok',
  'instagram',
  'youtube',
  'threads',
  'facebook',
  'spotify',
  'discord',
  'zalo',
  'website',
];

const inFlightUserAccounts = new Map<string, Promise<UserAccount | null>>();

export function sanitizeHandle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

export function sanitizeSafeUrl(raw: string, fallback = 'https://lumibio.app'): string {
  const trimmed = raw.trim().slice(0, LIMITS.URL_MAX);
  if (!trimmed) return fallback;
  if (trimmed.startsWith('/src/assets/')) return trimmed;
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return fallback;
  return `https://${trimmed}`.slice(0, LIMITS.URL_MAX);
}

export function sanitizeImagePath(raw: string, maxDataLen: number = LIMITS.AVATAR_DATA_MAX): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed.length <= maxDataLen ? trimmed : '';
  }
  const boundedUrl = trimmed.slice(0, LIMITS.URL_MAX);
  if (boundedUrl.startsWith('/src/assets/')) return boundedUrl;
  if (/^https?:\/\//i.test(boundedUrl)) return boundedUrl;
  return '';
}

export function sanitizeSocials(socials: SocialsMap): SocialsMap {
  const clean: SocialsMap = {};
  for (const key of ALLOWED_SOCIAL_KEYS) {
    const val = socials[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      clean[key] = val.trim().slice(0, LIMITS.SOCIAL_MAX);
    }
  }
  return clean;
}

export async function getUserAccount(uid: string): Promise<UserAccount | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? (snap.data() as UserAccount) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function ensureUserAccount(user: User, preferredName?: string): Promise<UserAccount | null> {
  if (!user.emailVerified) return null;
  const existingPromise = inFlightUserAccounts.get(user.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const run = (async (): Promise<UserAccount | null> => {
    const path = `users/${user.uid}`;
    try {
      const userRef = doc(db, 'users', user.uid);
      let snap;
      try {
        snap = await getDocFromServer(userRef);
      } catch {
        snap = await getDoc(userRef);
      }
      if (snap.exists()) {
        return snap.data() as UserAccount;
      }
      const displayName = (preferredName || user.displayName || user.email?.split('@')[0] || 'Creator')
        .trim()
        .slice(0, LIMITS.DISPLAY_NAME_MAX);
      const payload = {
        uid: user.uid,
        email: (user.email || 'user@lumibio.app').slice(0, 200),
        displayName: displayName || 'Creator',
        activeHandle: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, payload);
      const createdSnap = await getDoc(userRef);
      return createdSnap.exists() ? (createdSnap.data() as UserAccount) : (payload as unknown as UserAccount);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      inFlightUserAccounts.delete(user.uid);
    }
  })();

  inFlightUserAccounts.set(user.uid, run);
  return run;
}

export async function checkHandleAvailability(handleInput: string): Promise<{ available: boolean; normalized: string }> {
  const normalized = sanitizeHandle(handleInput);
  if (!HANDLE_REGEX.test(normalized)) {
    return { available: false, normalized };
  }
  const path = `bios/${normalized}`;
  try {
    const snap = await getDoc(doc(db, 'bios', normalized));
    return { available: !snap.exists(), normalized };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getBioWithLinks(
  handleInput: string
): Promise<{ profile: BioProfile; links: BioLink[] } | null> {
  const handle = sanitizeHandle(handleInput);
  if (!HANDLE_REGEX.test(handle)) return null;
  const bioPath = `bios/${handle}`;
  try {
    const bioSnap = await getDoc(doc(db, 'bios', handle));
    if (!bioSnap.exists()) return null;
    const profile = bioSnap.data() as BioProfile;

    const currentUid = auth.currentUser?.uid;
    const isOwner = currentUid === profile.ownerId;
    const linksQuery = isOwner && currentUid
      ? query(collection(db, 'bios', handle, 'links'), where('ownerId', '==', currentUid))
      : query(collection(db, 'bios', handle, 'links'), where('isPublished', '==', true));
    const linksSnap = await getDocs(linksQuery);
    const links = linksSnap.docs
      .map((d) => d.data() as BioLink)
      .sort((a, b) => a.order - b.order);
    return { profile, links };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, bioPath);
  }
}

export async function findOwnerBioHandle(uid: string): Promise<string> {
  const userAcc = await getUserAccount(uid);
  if (userAcc?.activeHandle) return userAcc.activeHandle;
  const path = 'bios';
  try {
    const q = query(collection(db, 'bios'), where('ownerId', '==', uid), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return (snap.docs[0].data() as BioProfile).handle;
    }
    return '';
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createOrClaimBio(
  user: User,
  draft: Omit<BioProfile, 'ownerId' | 'viewCount' | 'createdAt' | 'updatedAt'>,
  starterLinks: Array<
    Omit<BioLink, 'id' | 'bioHandle' | 'ownerId' | 'isPublished' | 'clicks' | 'createdAt' | 'updatedAt'>
  >
): Promise<BioProfile> {
  const handle = sanitizeHandle(draft.handle);
  if (!HANDLE_REGEX.test(handle)) {
    throw new Error('Handle phải từ 3–32 ký tự gồm chữ thường, số, gạch ngang hoặc gạch dưới.');
  }

  await ensureUserAccount(user);

  const bioRef = doc(db, 'bios', handle);
  const bioPath = `bios/${handle}`;
  const existing = await getDoc(bioRef);
  if (existing.exists()) {
    throw new Error(`Tên miền @${handle} đã có người sử dụng. Vui lòng chọn tên khác.`);
  }

  const bioPayload = {
    handle,
    ownerId: user.uid,
    displayName: (draft.displayName.trim() || 'Creator').slice(0, LIMITS.DISPLAY_NAME_MAX),
    tagline: draft.tagline.trim().slice(0, LIMITS.TAGLINE_MAX),
    category: draft.category.trim().slice(0, LIMITS.CATEGORY_MAX),
    location: draft.location.trim().slice(0, LIMITS.LOCATION_MAX),
    avatarUrl: sanitizeImagePath(draft.avatarUrl),
    coverUrl: sanitizeImagePath(draft.coverUrl),
    themeId: draft.themeId,
    layoutMode: draft.layoutMode,
    buttonRadius: draft.buttonRadius,
    fontMood: draft.fontMood,
    isPublished: draft.isPublished,
    viewCount: 0,
    socials: sanitizeSocials(draft.socials),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    // Step 1: Commit parent BioProfile and update UserAccount activeHandle
    const batch1 = writeBatch(db);
    batch1.set(bioRef, bioPayload);
    batch1.update(doc(db, 'users', user.uid), {
      activeHandle: handle,
      updatedAt: serverTimestamp(),
    });
    await batch1.commit();

    // Step 2: Commit initial links after parent exists (satisfies Master Gate exists() check)
    if (starterLinks.length > 0) {
      const batch2 = writeBatch(db);
      starterLinks.slice(0, 12).forEach((link, idx) => {
        const linkId = `lnk_${Date.now()}_${idx}`;
        const linkRef = doc(db, 'bios', handle, 'links', linkId);
        batch2.set(linkRef, {
          id: linkId,
          bioHandle: handle,
          ownerId: user.uid,
          title: (link.title.trim() || 'Liên kết mới').slice(0, LIMITS.LINK_TITLE_MAX),
          subtitle: link.subtitle.trim().slice(0, LIMITS.LINK_SUBTITLE_MAX),
          url: sanitizeSafeUrl(link.url),
          kind: link.kind,
          thumbnailUrl: sanitizeImagePath(link.thumbnailUrl, LIMITS.THUMBNAIL_DATA_MAX),
          order: idx,
          isActive: link.isActive,
          isPublished: draft.isPublished,
          clicks: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch2.commit();
    }

    return bioPayload as unknown as BioProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, bioPath);
  }
}

export async function updateBioProfile(
  handle: string,
  updates: Partial<
    Pick<
      BioProfile,
      | 'displayName'
      | 'tagline'
      | 'category'
      | 'location'
      | 'avatarUrl'
      | 'coverUrl'
      | 'themeId'
      | 'layoutMode'
      | 'buttonRadius'
      | 'fontMood'
      | 'isPublished'
      | 'socials'
    >
  >,
  currentLinks?: BioLink[]
): Promise<void> {
  const path = `bios/${handle}`;
  try {
    const cleanUpdates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (typeof updates.displayName === 'string') {
      cleanUpdates.displayName = (updates.displayName.trim() || 'Creator').slice(0, LIMITS.DISPLAY_NAME_MAX);
    }
    if (typeof updates.tagline === 'string') {
      cleanUpdates.tagline = updates.tagline.trim().slice(0, LIMITS.TAGLINE_MAX);
    }
    if (typeof updates.category === 'string') {
      cleanUpdates.category = updates.category.trim().slice(0, LIMITS.CATEGORY_MAX);
    }
    if (typeof updates.location === 'string') {
      cleanUpdates.location = updates.location.trim().slice(0, LIMITS.LOCATION_MAX);
    }
    if (typeof updates.avatarUrl === 'string') {
      cleanUpdates.avatarUrl = sanitizeImagePath(updates.avatarUrl);
    }
    if (typeof updates.coverUrl === 'string') {
      cleanUpdates.coverUrl = sanitizeImagePath(updates.coverUrl);
    }
    if (updates.themeId) cleanUpdates.themeId = updates.themeId;
    if (updates.layoutMode) cleanUpdates.layoutMode = updates.layoutMode;
    if (updates.buttonRadius) cleanUpdates.buttonRadius = updates.buttonRadius;
    if (updates.fontMood) cleanUpdates.fontMood = updates.fontMood;
    if (typeof updates.isPublished === 'boolean') cleanUpdates.isPublished = updates.isPublished;
    if (updates.socials) cleanUpdates.socials = sanitizeSocials(updates.socials);

    const batch = writeBatch(db);
    batch.update(doc(db, 'bios', handle), cleanUpdates);

    if (typeof updates.isPublished === 'boolean' && currentLinks && currentLinks.length > 0) {
      for (const link of currentLinks) {
        batch.update(doc(db, 'bios', handle, 'links', link.id), {
          isPublished: updates.isPublished,
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createBioLink(
  handle: string,
  ownerId: string,
  isPublished: boolean,
  link: Omit<BioLink, 'id' | 'bioHandle' | 'ownerId' | 'isPublished' | 'clicks' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const linkId = `lnk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const path = `bios/${handle}/links/${linkId}`;
  try {
    await setDoc(doc(db, 'bios', handle, 'links', linkId), {
      id: linkId,
      bioHandle: handle,
      ownerId,
      title: (link.title.trim() || 'Liên kết mới').slice(0, LIMITS.LINK_TITLE_MAX),
      subtitle: link.subtitle.trim().slice(0, LIMITS.LINK_SUBTITLE_MAX),
      url: sanitizeSafeUrl(link.url),
      kind: link.kind,
      thumbnailUrl: sanitizeImagePath(link.thumbnailUrl, LIMITS.THUMBNAIL_DATA_MAX),
      order: Math.max(0, Math.min(200, Math.round(link.order))),
      isActive: link.isActive,
      isPublished,
      clicks: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBioLink(
  handle: string,
  linkId: string,
  updates: Partial<Pick<BioLink, 'title' | 'subtitle' | 'url' | 'kind' | 'thumbnailUrl' | 'order' | 'isActive'>>
): Promise<void> {
  const path = `bios/${handle}/links/${linkId}`;
  try {
    const cleanUpdates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (typeof updates.title === 'string') {
      cleanUpdates.title = (updates.title.trim() || 'Liên kết').slice(0, LIMITS.LINK_TITLE_MAX);
    }
    if (typeof updates.subtitle === 'string') {
      cleanUpdates.subtitle = updates.subtitle.trim().slice(0, LIMITS.LINK_SUBTITLE_MAX);
    }
    if (typeof updates.url === 'string') {
      cleanUpdates.url = sanitizeSafeUrl(updates.url);
    }
    if (updates.kind) cleanUpdates.kind = updates.kind;
    if (typeof updates.thumbnailUrl === 'string') {
      cleanUpdates.thumbnailUrl = sanitizeImagePath(updates.thumbnailUrl, LIMITS.THUMBNAIL_DATA_MAX);
    }
    if (typeof updates.order === 'number') {
      cleanUpdates.order = Math.max(0, Math.min(200, Math.round(updates.order)));
    }
    if (typeof updates.isActive === 'boolean') cleanUpdates.isActive = updates.isActive;

    await updateDoc(doc(db, 'bios', handle, 'links', linkId), cleanUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function reorderBioLinks(handle: string, orderedLinks: BioLink[]): Promise<void> {
  const path = `bios/${handle}/links`;
  try {
    const batch = writeBatch(db);
    orderedLinks.forEach((link, idx) => {
      batch.update(doc(db, 'bios', handle, 'links', link.id), {
        order: idx,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBioLink(handle: string, linkId: string): Promise<void> {
  const path = `bios/${handle}/links/${linkId}`;
  try {
    await deleteDoc(doc(db, 'bios', handle, 'links', linkId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function recordBioView(handle: string): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;
  const path = `bios/${handle}`;
  try {
    await updateDoc(doc(db, 'bios', handle), {
      viewCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking analytics failure when unpublished or unverified
  }
}

export async function recordLinkClick(handle: string, linkId: string): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;
  const path = `bios/${handle}/links/${linkId}`;
  try {
    await updateDoc(doc(db, 'bios', handle, 'links', linkId), {
      clicks: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking analytics failure when unpublished or unverified
  }
}

export function subscribePublicBios(
  onData: (bios: BioProfile[]) => void
): () => void {
  const path = 'bios';
  const q = query(collection(db, 'bios'), where('isPublished', '==', true), limit(18));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as BioProfile);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeOwnerBioAndLinks(
  handle: string,
  ownerUid: string,
  onData: (profile: BioProfile | null, links: BioLink[]) => void
): () => void {
  const bioPath = `bios/${handle}`;
  const linksPath = `bios/${handle}/links`;
  let latestProfile: BioProfile | null = null;
  let latestLinks: BioLink[] = [];

  const unsubBio = onSnapshot(
    doc(db, 'bios', handle),
    (snap) => {
      latestProfile = snap.exists() ? (snap.data() as BioProfile) : null;
      onData(latestProfile, latestLinks);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, bioPath);
    }
  );

  const linksQ = query(
    collection(db, 'bios', handle, 'links'),
    where('ownerId', '==', ownerUid)
  );
  const unsubLinks = onSnapshot(
    linksQ,
    (snap) => {
      latestLinks = snap.docs
        .map((d) => d.data() as BioLink)
        .sort((a, b) => a.order - b.order);
      onData(latestProfile, latestLinks);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, linksPath);
    }
  );

  return () => {
    unsubBio();
    unsubLinks();
  };
}
