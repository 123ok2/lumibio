import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { ArrowLeft, LogOut, Pencil, UserPlus } from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { BioRenderer } from './components/BioRenderer';
import { BioStudio } from './components/BioStudio';
import {
  DEFAULT_TEMPLATE_LINKS,
  DEFAULT_TEMPLATE_PROFILE,
  GLASS_THEMES,
} from './data/themesAndPresets';
import { auth } from './lib/firebase';
import {
  ensureUserAccount,
  findOwnerBioHandle,
  getBioWithLinks,
  recordBioView,
  recordLinkClick,
} from './services/bioService';
import type { BioLink, BioProfile, ThemeId } from './types/bio';

type ActiveView = 'bio' | 'studio';

function readHandleFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return (params.get('u') || '').trim().toLowerCase();
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeHandle, setActiveHandle] = useState('');
  const [view, setView] = useState<ActiveView>('bio');
  const [viewingHandle, setViewingHandle] = useState<string>(() => readHandleFromUrl());

  const [bioProfile, setBioProfile] = useState<BioProfile>(DEFAULT_TEMPLATE_PROFILE);
  const [bioLinks, setBioLinks] = useState<BioLink[]>(DEFAULT_TEMPLATE_LINKS);
  const [loadingBio, setLoadingBio] = useState(false);
  const [notFoundHandle, setNotFoundHandle] = useState('');
  const [previewThemeId, setPreviewThemeId] = useState<ThemeId>('midnight');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingStudioAfterAuth, setPendingStudioAfterAuth] = useState(false);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser && firebaseUser.emailVerified) {
        try {
          await ensureUserAccount(firebaseUser);
          const foundHandle = await findOwnerBioHandle(firebaseUser.uid);
          setActiveHandle(foundHandle);
        } catch {
          // Handled safely
        }
      } else {
        setActiveHandle('');
      }
    });
    return () => unsub();
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      const h = readHandleFromUrl();
      setViewingHandle(h);
      setView('bio');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Load Bio from Firestore when ?u=handle is present, otherwise show owner's Bio or default template
  useEffect(() => {
    const targetHandle = viewingHandle || activeHandle;
    if (!targetHandle) {
      setBioProfile(DEFAULT_TEMPLATE_PROFILE);
      setBioLinks(DEFAULT_TEMPLATE_LINKS);
      setNotFoundHandle('');
      setPreviewThemeId(DEFAULT_TEMPLATE_PROFILE.themeId);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoadingBio(true);
      setNotFoundHandle('');
      try {
        const res = await getBioWithLinks(targetHandle);
        if (cancelled) return;
        if (res) {
          setBioProfile(res.profile);
          setBioLinks(res.links);
          setPreviewThemeId(res.profile.themeId);
          void recordBioView(targetHandle);
        } else if (viewingHandle) {
          setNotFoundHandle(viewingHandle);
        }
      } catch {
        if (!cancelled && viewingHandle) {
          setNotFoundHandle(viewingHandle);
        }
      } finally {
        if (!cancelled) setLoadingBio(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [viewingHandle, activeHandle, view]);

  const openStudio = () => {
    if (!user || !user.emailVerified) {
      setPendingStudioAfterAuth(true);
      setAuthModalOpen(true);
      return;
    }
    setView('studio');
  };

  const openPublicBio = (handle: string) => {
    const clean = handle.trim().toLowerCase();
    window.history.pushState({}, '', `/?u=${encodeURIComponent(clean)}`);
    setViewingHandle(clean);
    setView('bio');
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveHandle('');
    setView('bio');
    if (window.location.search) {
      window.history.pushState({}, '', '/');
    }
    setViewingHandle('');
  };

  const activeTheme = GLASS_THEMES[previewThemeId] || GLASS_THEMES.midnight;

  return (
    <div
      className="min-h-screen w-full relative overflow-x-hidden flex flex-col justify-center items-center px-4 py-6 transition-colors duration-300"
      style={{
        backgroundColor: activeTheme.bgColor,
        color: activeTheme.textPrimary,
      }}
    >
      {/* Ambient Moving Orbs Background matching user template */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute w-[320px] h-[320px] rounded-full blur-[90px] opacity-45 -top-[10%] -left-[10%] animate-orb-1"
          style={{ backgroundColor: activeTheme.orbColors[0] }}
        />
        <div
          className="absolute w-[350px] h-[350px] rounded-full blur-[90px] opacity-45 -bottom-[10%] -right-[10%] animate-orb-2"
          style={{ backgroundColor: activeTheme.orbColors[1] }}
        />
        <div
          className="absolute w-[250px] h-[250px] rounded-full blur-[90px] opacity-25 top-[40%] left-[45%] animate-orb-3"
          style={{ backgroundColor: activeTheme.orbColors[2] }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full flex flex-col items-center">
        {view === 'studio' && user && user.emailVerified ? (
          <>
            <div className="w-full max-w-[1120px] px-4 flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setView('bio')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900/70 border border-white/10 text-xs font-medium text-zinc-200 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Quay lại thẻ Bio
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900/70 border border-white/10 text-xs font-medium text-zinc-200 hover:text-white cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Đăng xuất
              </button>
            </div>

            <BioStudio
              user={user}
              activeHandle={activeHandle}
              onHandleClaimed={(h) => setActiveHandle(h)}
              onOpenPublicBio={openPublicBio}
            />
          </>
        ) : loadingBio ? (
          <div className="text-sm opacity-75">Đang tải trang Bio...</div>
        ) : notFoundHandle ? (
          <div
            className="w-full max-w-[440px] rounded-[28px] p-8 text-center backdrop-blur-2xl"
            style={{
              backgroundColor: activeTheme.cardBg,
              border: `1px solid ${activeTheme.cardBorder}`,
            }}
          >
            <h1 className="text-xl font-bold mb-2">Chưa có trang @{notFoundHandle}</h1>
            <p className="text-xs opacity-75 mb-6">
              Bạn có thể đăng ký tài khoản để sở hữu đường dẫn này ngay.
            </p>
            <button
              type="button"
              onClick={openStudio}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
            >
              Tạo trang @{notFoundHandle}
            </button>
          </div>
        ) : (
          <BioRenderer
            profile={{ ...bioProfile, themeId: previewThemeId }}
            links={bioLinks}
            onToggleTheme={(nextTheme) => setPreviewThemeId(nextTheme)}
            onLinkClick={(link) => {
              if (!bioProfile.ownerId.startsWith('template_')) {
                void recordLinkClick(bioProfile.handle, link.id);
              }
            }}
            topRightExtra={
              <button
                type="button"
                onClick={openStudio}
                className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-full text-xs font-semibold transition-transform duration-200 hover:scale-105 cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: activeTheme.btnBg,
                  border: `1px solid ${activeTheme.cardBorder}`,
                  color: activeTheme.textPrimary,
                }}
              >
                {user && user.emailVerified ? (
                  <>
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{activeHandle ? 'Sửa Bio' : 'Tạo Bio'}</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Tạo Bio của bạn</span>
                  </>
                )}
              </button>
            }
          />
        )}
      </div>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingStudioAfterAuth(false);
        }}
        needsVerificationUser={user && !user.emailVerified ? { email: user.email } : null}
        onAuthenticated={async () => {
          if (auth.currentUser && auth.currentUser.emailVerified) {
            await ensureUserAccount(auth.currentUser);
            const foundHandle = await findOwnerBioHandle(auth.currentUser.uid);
            setActiveHandle(foundHandle);
            if (pendingStudioAfterAuth) {
              setView('studio');
              setPendingStudioAfterAuth(false);
            }
          }
        }}
      />
    </div>
  );
}
