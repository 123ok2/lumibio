import { useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DEFAULT_TEMPLATE_LINKS,
  DEFAULT_TEMPLATE_PROFILE,
  GLASS_THEMES,
  SOCIAL_DOCK_PLATFORMS,
  STUDIO_AVATARS,
} from '../data/themesAndPresets';
import {
  checkHandleAvailability,
  createBioLink,
  createOrClaimBio,
  deleteBioLink,
  reorderBioLinks,
  sanitizeHandle,
  subscribeOwnerBioAndLinks,
  updateBioLink,
  updateBioProfile,
} from '../services/bioService';
import {
  HANDLE_REGEX,
  LIMITS,
  type BioLink,
  type BioProfile,
  type SocialPlatformKey,
  type ThemeId,
} from '../types/bio';
import {
  estimateDataUrlBytes,
  formatByteSize,
  isEncodedImageDataUrl,
  processDeviceImageFile,
} from '../utils/imageCodec';
import { BioRenderer } from './BioRenderer';
import { SocialPlatformIcon } from './SocialIcons';

interface BioStudioProps {
  user: User;
  activeHandle: string;
  onHandleClaimed: (handle: string) => void;
  onOpenPublicBio: (handle: string) => void;
}

const QUICK_LINK_PRESETS = [
  {
    label: '+ Facebook',
    title: 'Facebook',
    subtitle: 'Kết nối & cập nhật hoạt động mới nhất',
    url: 'https://facebook.com/',
    iconKey: 'facebook' as const,
  },
  {
    label: '+ TikTok',
    title: 'TikTok',
    subtitle: 'Video ngắn & chia sẻ sáng tạo',
    url: 'https://tiktok.com/@',
    iconKey: 'tiktok' as const,
  },
  {
    label: '+ YouTube',
    title: 'YouTube',
    subtitle: 'Kênh video chính thức',
    url: 'https://youtube.com/@',
    iconKey: 'youtube' as const,
  },
  {
    label: '+ Zalo',
    title: 'Zalo',
    subtitle: 'Nhắn tin & trao đổi trực tiếp',
    url: 'https://zalo.me/',
    iconKey: 'zalo' as const,
  },
  {
    label: '+ GitHub / Web',
    title: 'GitHub / Dự án',
    subtitle: 'Kho lưu trữ mã nguồn & sản phẩm số',
    url: 'https://github.com/',
    iconKey: 'github' as const,
  },
];

export function BioStudio({
  user,
  activeHandle,
  onHandleClaimed,
  onOpenPublicBio,
}: BioStudioProps) {
  const [claimHandle, setClaimHandle] = useState(() =>
    sanitizeHandle(user.displayName || user.email?.split('@')[0] || 'username')
  );
  const [claimName, setClaimName] = useState(user.displayName || 'Tên Hiển Thị Của Bạn');
  const [claimFacebookUrl, setClaimFacebookUrl] = useState('https://facebook.com/');
  const [claimAvatarUrl, setClaimAvatarUrl] = useState(DEFAULT_TEMPLATE_PROFILE.avatarUrl);
  const [claimAvatarNote, setClaimAvatarNote] = useState('');
  const [uploadingClaimAvatar, setUploadingClaimAvatar] = useState(false);
  const [claimAvailability, setClaimAvailability] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');

  const [profile, setProfile] = useState<BioProfile | null>(null);
  const [draft, setDraft] = useState<BioProfile | null>(null);
  const [links, setLinks] = useState<BioLink[]>([]);
  const [loadingBio, setLoadingBio] = useState(Boolean(activeHandle));
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarStatusNote, setAvatarStatusNote] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkSubtitle, setNewLinkSubtitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkThumbnailUrl, setNewLinkThumbnailUrl] = useState('');
  const [uploadingNewThumb, setUploadingNewThumb] = useState(false);
  const [addingLink, setAddingLink] = useState(false);

  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editLinkDraft, setEditLinkDraft] = useState<{
    title: string;
    subtitle: string;
    url: string;
    thumbnailUrl: string;
  } | null>(null);
  const [uploadingEditThumb, setUploadingEditThumb] = useState(false);

  useEffect(() => {
    if (activeHandle) return;
    const normalized = sanitizeHandle(claimHandle);
    if (!HANDLE_REGEX.test(normalized)) {
      setClaimAvailability('invalid');
      return;
    }
    setClaimAvailability('checking');
    const timer = window.setTimeout(async () => {
      try {
        const res = await checkHandleAvailability(normalized);
        setClaimAvailability(res.available ? 'available' : 'taken');
      } catch {
        setClaimAvailability('idle');
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [claimHandle, activeHandle]);

  useEffect(() => {
    if (!activeHandle) {
      setLoadingBio(false);
      setProfile(null);
      setDraft(null);
      setLinks([]);
      return;
    }
    setLoadingBio(true);
    const unsub = subscribeOwnerBioAndLinks(activeHandle, user.uid, (loadedProfile, loadedLinks) => {
      if (loadedProfile) {
        setProfile(loadedProfile);
        setDraft((prev) => (prev && prev.handle === loadedProfile.handle ? prev : loadedProfile));
      }
      setLinks(loadedLinks);
      setLoadingBio(false);
    });
    return () => unsub();
  }, [activeHandle, user.uid]);

  const showToast = (msg: string) => {
    setSaveNotice(msg);
    window.setTimeout(() => setSaveNotice(''), 2400);
  };

  const handleClaimSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setClaimError('');
    const normalized = sanitizeHandle(claimHandle);
    if (!HANDLE_REGEX.test(normalized)) {
      setClaimError('Tên đường dẫn cần 3–32 ký tự chữ thường không dấu, số, - hoặc _.');
      return;
    }
    setClaiming(true);
    try {
      const fbUrl = claimFacebookUrl.trim() || 'https://facebook.com/';
      const starterLinks = DEFAULT_TEMPLATE_LINKS.map((l, idx) => ({
        title: l.title,
        subtitle: l.subtitle,
        url: idx === 0 ? fbUrl : l.url,
        kind: l.kind,
        thumbnailUrl: '',
        order: idx,
        isActive: true,
      }));

      await createOrClaimBio(
        user,
        {
          handle: normalized,
          displayName: claimName.trim() || DEFAULT_TEMPLATE_PROFILE.displayName,
          tagline: '',
          category: '',
          location: '',
          avatarUrl: claimAvatarUrl || DEFAULT_TEMPLATE_PROFILE.avatarUrl,
          coverUrl: '',
          themeId: 'midnight',
          layoutMode: 'stack',
          buttonRadius: 'soft',
          fontMood: 'modern',
          isPublished: true,
          socials: DEFAULT_TEMPLATE_PROFILE.socials,
        },
        starterLinks
      );
      onHandleClaimed(normalized);
    } catch (err: unknown) {
      setClaimError(err instanceof Error ? err.message : 'Không thể khởi tạo trang Bio.');
    } finally {
      setClaiming(false);
    }
  };

  const handleSaveProfile = async (overrideUpdates?: Partial<BioProfile>) => {
    if (!draft) return;
    const target = overrideUpdates ? { ...draft, ...overrideUpdates } : draft;
    if (overrideUpdates) {
      setDraft(target);
    }
    setSavingProfile(true);
    try {
      const publishChanged = profile && target.isPublished !== profile.isPublished;
      await updateBioProfile(
        target.handle,
        {
          displayName: target.displayName,
          tagline: target.tagline,
          avatarUrl: target.avatarUrl,
          themeId: target.themeId,
          isPublished: target.isPublished,
          socials: target.socials,
        },
        publishChanged ? links : undefined
      );
      setProfile(target);
      showToast('Đã lưu lên Firebase');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUploadClaimAvatar = async (file: File | undefined) => {
    if (!file) return;
    setClaimError('');
    setUploadingClaimAvatar(true);
    try {
      const processed = await processDeviceImageFile(file, 'avatar');
      setClaimAvatarUrl(processed.dataUrl);
      setClaimAvatarNote(
        processed.wasConverted
          ? `Đã tự nén & mã hóa (${formatByteSize(processed.originalBytes)} → ${formatByteSize(processed.finalBytes)})`
          : `Ảnh nhỏ giữ nguyên & mã hóa (${formatByteSize(processed.finalBytes)})`
      );
    } catch (err: unknown) {
      setClaimError(err instanceof Error ? err.message : 'Không thể xử lý ảnh.');
    } finally {
      setUploadingClaimAvatar(false);
    }
  };

  const handleUploadStudioAvatar = async (file: File | undefined) => {
    if (!file || !draft) return;
    setAvatarError('');
    setUploadingAvatar(true);
    try {
      const processed = await processDeviceImageFile(file, 'avatar');
      const note = processed.wasConverted
        ? `Tự convert & mã hóa: ${formatByteSize(processed.originalBytes)} → ${formatByteSize(processed.finalBytes)} (${processed.width}×${processed.height})`
        : `Ảnh nhỏ giữ nguyên & mã hóa: ${formatByteSize(processed.finalBytes)} (${processed.width}×${processed.height})`;
      setAvatarStatusNote(note);
      await handleSaveProfile({ avatarUrl: processed.dataUrl });
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'Không thể xử lý ảnh từ thiết bị.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUploadLinkThumbnail = async (
    file: File | undefined,
    mode: 'new' | 'edit'
  ) => {
    if (!file) return;
    if (mode === 'new') setUploadingNewThumb(true);
    else setUploadingEditThumb(true);
    try {
      const processed = await processDeviceImageFile(file, 'thumbnail');
      if (mode === 'new') {
        setNewLinkThumbnailUrl(processed.dataUrl);
      } else if (editLinkDraft) {
        setEditLinkDraft({ ...editLinkDraft, thumbnailUrl: processed.dataUrl });
      }
      showToast(
        processed.wasConverted
          ? `Đã nén icon (${formatByteSize(processed.finalBytes)})`
          : `Đã mã hóa icon (${formatByteSize(processed.finalBytes)})`
      );
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'Không thể xử lý ảnh icon.');
    } finally {
      if (mode === 'new') setUploadingNewThumb(false);
      else setUploadingEditThumb(false);
    }
  };

  const openQuickPresetForm = (preset: (typeof QUICK_LINK_PRESETS)[number]) => {
    setNewLinkTitle(preset.title);
    setNewLinkSubtitle(preset.subtitle);
    setNewLinkUrl(preset.url);
    setNewLinkThumbnailUrl('');
    setShowAddLink(true);
  };

  const handleAddLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !newLinkTitle.trim() || !newLinkUrl.trim()) return;
    setAddingLink(true);
    try {
      await createBioLink(draft.handle, user.uid, draft.isPublished, {
        title: newLinkTitle,
        subtitle: newLinkSubtitle,
        url: newLinkUrl,
        kind: 'link',
        thumbnailUrl: newLinkThumbnailUrl,
        order: links.length,
        isActive: true,
      });
      setNewLinkTitle('');
      setNewLinkSubtitle('');
      setNewLinkUrl('');
      setNewLinkThumbnailUrl('');
      setShowAddLink(false);
      showToast('Đã thêm liên kết');
    } finally {
      setAddingLink(false);
    }
  };

  const handleMoveLink = async (index: number, direction: -1 | 1) => {
    if (!draft) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= links.length) return;
    const reordered = [...links];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setLinks(reordered.map((l, idx) => ({ ...l, order: idx })));
    await reorderBioLinks(draft.handle, reordered);
  };

  const handleToggleLinkActive = async (link: BioLink) => {
    if (!draft) return;
    await updateBioLink(draft.handle, link.id, { isActive: !link.isActive });
  };

  const handleSaveEditLink = async (linkId: string) => {
    if (!draft || !editLinkDraft) return;
    await updateBioLink(draft.handle, linkId, editLinkDraft);
    setEditingLinkId(null);
    setEditLinkDraft(null);
    showToast('Đã cập nhật liên kết');
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!draft) return;
    await deleteBioLink(draft.handle, linkId);
    showToast('Đã xóa liên kết');
  };

  const handleCopyShareUrl = (handle: string) => {
    const url = `${window.location.origin}/?u=${encodeURIComponent(handle)}`;
    void navigator.clipboard?.writeText(url);
    setCopiedUrl(true);
    window.setTimeout(() => setCopiedUrl(false), 1800);
  };

  // --- ONBOARDING ---
  if (!activeHandle) {
    const previewProfile: BioProfile = {
      ...DEFAULT_TEMPLATE_PROFILE,
      handle: sanitizeHandle(claimHandle) || 'username',
      displayName: claimName.trim() || DEFAULT_TEMPLATE_PROFILE.displayName,
      avatarUrl: claimAvatarUrl || DEFAULT_TEMPLATE_PROFILE.avatarUrl,
    };
    const previewLinks = DEFAULT_TEMPLATE_LINKS.map((l, idx) =>
      idx === 0 ? { ...l, url: claimFacebookUrl || l.url } : l
    );

    return (
      <div className="w-full max-w-[1040px] mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 rounded-[28px] p-6 sm:p-8 backdrop-blur-2xl bg-zinc-900/70 border border-white/10 text-zinc-100 shadow-2xl">
          <h1 className="text-2xl font-bold tracking-tight mb-1.5">Tạo trang Bio của bạn</h1>
          <p className="text-xs text-zinc-400 mb-6">
            Khởi tạo sẵn thẻ Facebook, TikTok, YouTube, Zalo và thanh Dock mạng xã hội.
          </p>

          {claimError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200">
              {claimError}
            </div>
          )}

          <form onSubmit={handleClaimSubmit} className="space-y-4">
            <div>
              <label htmlFor="claim-handle" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Đường dẫn Bio (@username)
              </label>
              <div className="flex items-center rounded-xl border border-white/10 bg-zinc-950/60 overflow-hidden focus-within:border-blue-500">
                <span className="px-3 py-2.5 text-xs font-mono text-zinc-400 border-r border-white/10">
                  ?u=
                </span>
                <input
                  id="claim-handle"
                  type="text"
                  required
                  maxLength={32}
                  value={claimHandle}
                  onChange={(e) => setClaimHandle(sanitizeHandle(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm font-mono bg-transparent text-white focus:outline-none"
                />
              </div>
              <div className="mt-1.5 text-xs">
                {claimAvailability === 'checking' && <span className="text-zinc-400">Đang kiểm tra...</span>}
                {claimAvailability === 'available' && (
                  <span className="text-emerald-400">✓ @{sanitizeHandle(claimHandle)} sẵn sàng</span>
                )}
                {claimAvailability === 'taken' && (
                  <span className="text-red-400">✕ @{sanitizeHandle(claimHandle)} đã tồn tại</span>
                )}
                {claimAvailability === 'invalid' && (
                  <span className="text-zinc-400">3–32 ký tự chữ thường không dấu, số, - hoặc _.</span>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="claim-name" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Tên hiển thị
              </label>
              <input
                id="claim-name"
                type="text"
                required
                maxLength={LIMITS.DISPLAY_NAME_MAX}
                value={claimName}
                onChange={(e) => setClaimName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-950/60 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="claim-fb" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Link Facebook của bạn
              </label>
              <input
                id="claim-fb"
                type="text"
                maxLength={LIMITS.URL_MAX}
                value={claimFacebookUrl}
                onChange={(e) => setClaimFacebookUrl(e.target.value)}
                placeholder="https://facebook.com/ten.cua.ban"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-950/60 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Ảnh đại diện (tải từ thiết bị — tự nén & mã hóa lên Firebase)
              </span>
              <div className="flex items-center gap-3">
                <img
                  src={claimAvatarUrl}
                  alt="Xem trước ảnh đại diện"
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover border border-white/15 shrink-0"
                />
                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/15 bg-zinc-950/70 hover:bg-zinc-800/80 text-xs font-medium text-zinc-200 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingClaimAvatar ? 'Đang xử lý ảnh...' : 'Tải ảnh từ thiết bị'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingClaimAvatar}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      void handleUploadClaimAvatar(f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              {claimAvatarNote && (
                <p className="mt-1.5 text-[11px] text-emerald-400">{claimAvatarNote}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={claiming || claimAvailability === 'taken' || claimAvailability === 'invalid'}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 mt-2"
            >
              {claiming ? 'Đang tạo...' : 'Tạo & Bắt đầu trang trí'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-6 flex justify-center">
          <BioRenderer profile={previewProfile} links={previewLinks} enableTilt={false} />
        </div>
      </div>
    );
  }

  if (loadingBio || !draft) {
    return (
      <div className="py-16 text-center text-sm text-zinc-400">
        Đang tải trình trang trí Bio...
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1120px] mx-auto px-4 py-6">
      {/* Top Studio Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 rounded-2xl px-5 py-3.5 backdrop-blur-xl bg-zinc-900/70 border border-white/10 text-zinc-100">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-bold truncate">@{draft.handle}</span>
          {saveNotice && <span className="text-xs text-emerald-400 font-medium">{saveNotice}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSaveProfile({ isPublished: !draft.isPublished })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/10 text-xs font-medium cursor-pointer"
          >
            {draft.isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {draft.isPublished ? 'Công khai' : 'Đang ẩn'}
          </button>

          <button
            type="button"
            onClick={() => handleCopyShareUrl(draft.handle)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/10 text-xs font-medium cursor-pointer"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedUrl ? 'Đã sao chép' : 'Sao chép link'}
          </button>

          <button
            type="button"
            onClick={() => onOpenPublicBio(draft.handle)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Xem trang Bio
          </button>
        </div>
      </div>

      {/* Main Split: Left Link Decorator / Right Live Glass Bio Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Identity & Theme Appearance */}
          <div className="rounded-[24px] p-5 sm:p-6 backdrop-blur-xl bg-zinc-900/70 border border-white/10 text-zinc-100 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Thông tin & Giao diện kính</h2>
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => handleSaveProfile()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {savingProfile ? 'Đang lưu...' : 'Lưu thông tin'}
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label htmlFor="studio-name" className="block text-xs text-zinc-400 mb-1">
                  Tên hiển thị
                </label>
                <input
                  id="studio-name"
                  type="text"
                  maxLength={LIMITS.DISPLAY_NAME_MAX}
                  value={draft.displayName}
                  onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-white/10 bg-zinc-950/60 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="rounded-2xl p-3.5 bg-zinc-950/50 border border-white/10 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-300">
                    Ảnh đại diện (lưu mã hóa Base64 trên Firebase)
                  </span>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingAvatar ? 'Đang nén & mã hóa...' : 'Tải ảnh từ thiết bị'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingAvatar}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        void handleUploadStudioAvatar(f);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {isEncodedImageDataUrl(draft.avatarUrl) ? (
                  <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={draft.avatarUrl}
                        alt="Avatar mã hóa"
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-lg object-cover shrink-0"
                      />
                      <span className="text-xs text-emerald-300 truncate">
                        Đã mã hóa từ thiết bị ({formatByteSize(estimateDataUrlBytes(draft.avatarUrl))})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarStatusNote('');
                        setDraft({ ...draft, avatarUrl: '' });
                      }}
                      className="text-xs text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                    >
                      Dùng link URL
                    </button>
                  </div>
                ) : (
                  <input
                    id="studio-avatar"
                    type="text"
                    maxLength={LIMITS.URL_MAX}
                    value={draft.avatarUrl}
                    onChange={(e) => setDraft({ ...draft, avatarUrl: e.target.value })}
                    placeholder="Hoặc dán link ảnh https://..."
                    className="w-full px-3.5 py-2 rounded-xl border border-white/10 bg-zinc-900/70 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                )}

                {avatarStatusNote && (
                  <p className="text-[11px] text-emerald-400">{avatarStatusNote}</p>
                )}
                {avatarError && (
                  <p className="text-[11px] text-red-400">{avatarError}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {STUDIO_AVATARS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => {
                    setAvatarStatusNote('');
                    setAvatarError('');
                    void handleSaveProfile({ avatarUrl: av.url });
                  }}
                  className={`flex items-center gap-2 pr-3 pl-1 py-1 rounded-xl border text-xs cursor-pointer ${
                    draft.avatarUrl === av.url
                      ? 'border-blue-500 bg-blue-500/15 text-white'
                      : 'border-white/10 bg-zinc-950/40 text-zinc-300'
                  }`}
                >
                  <img
                    src={av.url}
                    alt={av.label}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-lg object-cover"
                  />
                  <span>{av.label}</span>
                </button>
              ))}
            </div>

            {/* Glass Theme Color Orbs Picker */}
            <div className="pt-2 border-t border-white/10">
              <div className="text-xs text-zinc-400 mb-2">Màu nền & Đốm sáng</div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(GLASS_THEMES) as ThemeId[]).map((tid) => {
                  const t = GLASS_THEMES[tid];
                  const active = draft.themeId === tid;
                  return (
                    <button
                      key={tid}
                      type="button"
                      onClick={() => handleSaveProfile({ themeId: tid })}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                        active
                          ? 'border-blue-500 bg-blue-500/15 text-white'
                          : 'border-white/10 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-800/60'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{
                          background: `linear-gradient(135deg, ${t.orbColors[0]}, ${t.orbColors[2]})`,
                        }}
                      />
                      <span>{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. Links List (Facebook + Social Platforms) */}
          <div className="rounded-[24px] p-5 sm:p-6 backdrop-blur-xl bg-zinc-900/70 border border-white/10 text-zinc-100 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Danh sách link chính</h2>
              <button
                type="button"
                onClick={() => {
                  setNewLinkTitle('');
                  setNewLinkSubtitle('');
                  setNewLinkUrl('');
                  setShowAddLink((v) => !v);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm link mới
              </button>
            </div>

            {/* Quick Add Platform Chips */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_LINK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => openQuickPresetForm(preset)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/10 bg-zinc-950/50 hover:bg-zinc-800/70 text-xs text-zinc-200 cursor-pointer"
                >
                  <SocialPlatformIcon platform={preset.iconKey} className="w-3.5 h-3.5" />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>

            {showAddLink && (
              <form
                onSubmit={handleAddLink}
                className="p-4 rounded-2xl bg-zinc-950/70 border border-blue-500/40 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    maxLength={LIMITS.LINK_TITLE_MAX}
                    value={newLinkTitle}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                    placeholder="Tên nút (VD: Facebook)"
                    className="px-3 py-2 rounded-xl border border-white/10 bg-zinc-900 text-sm text-white"
                  />
                  <input
                    type="text"
                    required
                    maxLength={LIMITS.URL_MAX}
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="https://facebook.com/..."
                    className="px-3 py-2 rounded-xl border border-white/10 bg-zinc-900 text-sm text-white"
                  />
                </div>
                <input
                  type="text"
                  maxLength={LIMITS.LINK_SUBTITLE_MAX}
                  value={newLinkSubtitle}
                  onChange={(e) => setNewLinkSubtitle(e.target.value)}
                  placeholder="Mô tả ngắn (VD: Kết nối & cập nhật hoạt động mới nhất)"
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-zinc-900 text-sm text-white"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 cursor-pointer">
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>{uploadingNewThumb ? 'Đang nén...' : 'Ảnh icon riêng (tùy chọn)'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingNewThumb}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          void handleUploadLinkThumbnail(f, 'new');
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                    {newLinkThumbnailUrl && (
                      <div className="flex items-center gap-1.5">
                        <img
                          src={newLinkThumbnailUrl}
                          alt="Icon riêng"
                          className="w-7 h-7 rounded-lg object-cover border border-white/15"
                        />
                        <button
                          type="button"
                          onClick={() => setNewLinkThumbnailUrl('')}
                          aria-label="Xóa ảnh icon"
                          className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewLinkThumbnailUrl('');
                        setShowAddLink(false);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={addingLink || uploadingNewThumb}
                      className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {addingLink ? 'Đang thêm...' : 'Lưu link'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="space-y-2.5">
              {links.map((link, idx) => {
                const isEditing = editingLinkId === link.id && editLinkDraft;
                return (
                  <div
                    key={link.id}
                    className="rounded-2xl p-3.5 bg-zinc-950/50 border border-white/10"
                  >
                    {isEditing ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            maxLength={LIMITS.LINK_TITLE_MAX}
                            value={editLinkDraft.title}
                            onChange={(e) =>
                              setEditLinkDraft({ ...editLinkDraft, title: e.target.value })
                            }
                            className="px-3 py-2 rounded-xl border border-white/10 bg-zinc-900 text-sm text-white"
                          />
                          <input
                            type="text"
                            maxLength={LIMITS.URL_MAX}
                            value={editLinkDraft.url}
                            onChange={(e) =>
                              setEditLinkDraft({ ...editLinkDraft, url: e.target.value })
                            }
                            className="px-3 py-2 rounded-xl border border-white/10 bg-zinc-900 text-sm text-white"
                          />
                        </div>
                        <input
                          type="text"
                          maxLength={LIMITS.LINK_SUBTITLE_MAX}
                          value={editLinkDraft.subtitle}
                          onChange={(e) =>
                            setEditLinkDraft({ ...editLinkDraft, subtitle: e.target.value })
                          }
                          placeholder="Mô tả phụ"
                          className="w-full px-3 py-2 rounded-xl border border-white/10 bg-zinc-900 text-sm text-white"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 cursor-pointer">
                              <ImagePlus className="w-3.5 h-3.5" />
                              <span>{uploadingEditThumb ? 'Đang nén...' : 'Đổi ảnh icon'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                disabled={uploadingEditThumb}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  void handleUploadLinkThumbnail(f, 'edit');
                                  e.target.value = '';
                                }}
                                className="hidden"
                              />
                            </label>
                            {editLinkDraft.thumbnailUrl && (
                              <div className="flex items-center gap-1.5">
                                <img
                                  src={editLinkDraft.thumbnailUrl}
                                  alt="Icon link"
                                  className="w-6 h-6 rounded-md object-cover border border-white/15"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditLinkDraft({ ...editLinkDraft, thumbnailUrl: '' })
                                  }
                                  className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                                >
                                  Dùng icon mặc định
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLinkId(null);
                                setEditLinkDraft(null);
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              disabled={uploadingEditThumb}
                              onClick={() => handleSaveEditLink(link.id)}
                              className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              Cập nhật
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveLink(idx, -1)}
                              aria-label="Lên"
                              className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-25 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === links.length - 1}
                              onClick={() => handleMoveLink(idx, 1)}
                              aria-label="Xuống"
                              className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-25 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {link.thumbnailUrl && (
                            <img
                              src={link.thumbnailUrl}
                              alt={link.title}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div
                              className={`text-sm font-semibold truncate ${
                                link.isActive ? 'text-white' : 'line-through text-zinc-500'
                              }`}
                            >
                              {link.title}
                            </div>
                            <div className="text-xs text-zinc-400 truncate">{link.url}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleLinkActive(link)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
                            title={link.isActive ? 'Ẩn' : 'Hiện'}
                          >
                            {link.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLinkId(link.id);
                              setEditLinkDraft({
                                title: link.title,
                                subtitle: link.subtitle,
                                url: link.url,
                                thumbnailUrl: link.thumbnailUrl || '',
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 cursor-pointer"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLink(link.id)}
                            aria-label="Xóa"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Bottom Social Dock */}
          <div className="rounded-[24px] p-5 sm:p-6 backdrop-blur-xl bg-zinc-900/70 border border-white/10 text-zinc-100 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Thanh icon phụ dưới cùng</h2>
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => handleSaveProfile()}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                Lưu dock
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SOCIAL_DOCK_PLATFORMS.map((dock) => (
                <div key={dock.key} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-zinc-950/70 border border-white/10 flex items-center justify-center text-zinc-300 shrink-0">
                    <SocialPlatformIcon platform={dock.key} className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    maxLength={LIMITS.SOCIAL_MAX}
                    value={draft.socials[dock.key as SocialPlatformKey] || ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        socials: { ...draft.socials, [dock.key]: e.target.value },
                      })
                    }
                    placeholder={`${dock.label}: ${dock.placeholder}`}
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-zinc-950/60 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sticky Live Glass Card Preview */}
        <div className="lg:col-span-5 flex justify-center lg:sticky lg:top-6">
          <BioRenderer
            profile={draft}
            links={links}
            onToggleTheme={(nextTheme) => handleSaveProfile({ themeId: nextTheme })}
          />
        </div>
      </div>
    </div>
  );
}
