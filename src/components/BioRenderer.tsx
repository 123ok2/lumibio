import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BadgeCheck, CheckCircle2, ExternalLink, Moon, Share2, Sun } from 'lucide-react';
import {
  detectPlatformFromUrl,
  GLASS_THEMES,
  PLATFORM_BRAND_STYLES,
  resolveSocialUrl,
  SOCIAL_DOCK_PLATFORMS,
} from '../data/themesAndPresets';
import type { BioLink, BioProfile, SocialPlatformKey, ThemeId } from '../types/bio';
import { SocialPlatformIcon } from './SocialIcons';

interface BioRendererProps {
  profile: BioProfile;
  links: BioLink[];
  onLinkClick?: (link: BioLink) => void;
  onToggleTheme?: (nextThemeId: ThemeId) => void;
  topRightExtra?: ReactNode;
  enableTilt?: boolean;
}

export function BioRenderer({
  profile,
  links,
  onLinkClick,
  onToggleTheme,
  topRightExtra,
  enableTilt = true,
}: BioRendererProps) {
  const [localThemeOverride, setLocalThemeOverride] = useState<ThemeId | null>(null);
  const effectiveThemeId = localThemeOverride || profile.themeId || 'midnight';
  const theme = GLASS_THEMES[effectiveThemeId] || GLASS_THEMES.midnight;

  const [avatarFailed, setAvatarFailed] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAvatarFailed(false);
  }, [profile.avatarUrl]);

  const activeLinks = links
    .filter((l) => l.isActive)
    .sort((a, b) => a.order - b.order);

  const activeDockSocials = SOCIAL_DOCK_PLATFORMS.filter(
    (p) => typeof profile.socials[p.key] === 'string' && profile.socials[p.key]!.trim().length > 0
  );

  const handleCopyShare = async () => {
    const shareUrl = `${window.location.origin}/?u=${encodeURIComponent(profile.handle)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowToast(true);
      window.setTimeout(() => setShowToast(false), 2400);
    } catch {
      setShowToast(true);
      window.setTimeout(() => setShowToast(false), 2400);
    }
  };

  const handleToggleDarkLight = () => {
    const nextId: ThemeId = theme.isDark ? 'cobalt' : 'midnight';
    if (onToggleTheme) {
      onToggleTheme(nextId);
    } else {
      setLocalThemeOverride(nextId);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enableTilt || window.innerWidth < 768 || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rotateY = (centerX - e.clientX) / 45;
    const rotateX = (e.clientY - centerY) / 45;
    cardRef.current.style.transform = `perspective(1000px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg)';
  };

  return (
    <>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full max-w-[440px] rounded-[28px] p-6 sm:px-6 sm:py-8 backdrop-blur-2xl relative animate-fade-up transition-[background-color,border-color,color] duration-300"
        style={{
          backgroundColor: theme.cardBg,
          border: `1px solid ${theme.cardBorder}`,
          color: theme.textPrimary,
          boxShadow: theme.isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.55)'
            : '0 25px 50px -12px rgba(15, 23, 42, 0.14)',
        }}
      >
        {/* Top Actions Bar */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <button
            type="button"
            onClick={handleCopyShare}
            title="Sao chép liên kết"
            aria-label="Sao chép liên kết trang Bio"
            className="w-[38px] h-[38px] rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-105 cursor-pointer"
            style={{
              backgroundColor: theme.btnBg,
              border: `1px solid ${theme.cardBorder}`,
              color: theme.textPrimary,
            }}
          >
            <Share2 className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            {topRightExtra}
            <button
              type="button"
              onClick={handleToggleDarkLight}
              title="Đổi giao diện Sáng/Tối"
              aria-label="Đổi giao diện Sáng/Tối"
              className="w-[38px] h-[38px] rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-105 cursor-pointer"
              style={{
                backgroundColor: theme.btnBg,
                border: `1px solid ${theme.cardBorder}`,
                color: theme.textPrimary,
              }}
            >
              {theme.isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Profile Header */}
        <header className="text-center mb-7">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute -inset-1 rounded-full animate-avatar-ring z-0" aria-hidden="true" />
            <div
              className="relative w-full h-full rounded-full overflow-hidden z-10 flex items-center justify-center text-2xl font-bold"
              style={{
                border: `3px solid ${theme.bgColor}`,
                backgroundColor: theme.btnBg,
                color: theme.textPrimary,
              }}
            >
              {profile.avatarUrl && !avatarFailed ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{(profile.displayName || 'LB').slice(0, 2).toUpperCase()}</span>
              )}
            </div>
          </div>

          <h1 className="text-[22px] font-bold tracking-tight flex items-center justify-center gap-1.5">
            <span>{profile.displayName || 'Tên Hiển Thị'}</span>
            <BadgeCheck className="w-5 h-5 text-[#3b82f6] shrink-0" aria-hidden="true" />
          </h1>
          <p className="text-sm mt-1" style={{ color: theme.textSecondary }}>
            @{profile.handle}
          </p>
          {profile.tagline && (
            <p className="text-xs mt-2 leading-relaxed max-w-xs mx-auto" style={{ color: theme.textSecondary }}>
              {profile.tagline}
            </p>
          )}
        </header>

        {/* Main Platform Link Cards */}
        <section className="flex flex-col gap-3.5">
          {activeLinks.length === 0 ? (
            <div
              className="p-6 rounded-[18px] text-center text-sm"
              style={{
                backgroundColor: theme.btnBg,
                border: `1px dashed ${theme.cardBorder}`,
                color: theme.textSecondary,
              }}
            >
              Chưa có liên kết nào được bật.
            </div>
          ) : (
            activeLinks.map((link) => {
              const platformKey = detectPlatformFromUrl(link.url);
              const brand = PLATFORM_BRAND_STYLES[platformKey] || PLATFORM_BRAND_STYLES.website;
              const cssVars = {
                '--brand-color': brand.color,
                '--brand-shadow': brand.shadow,
                backgroundColor: theme.btnBg,
                border: `1px solid ${theme.cardBorder}`,
                color: theme.textPrimary,
              } as CSSProperties;

              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onLinkClick?.(link)}
                  className="bio-link-card flex items-center px-[18px] py-[14px] rounded-[18px] no-underline"
                  style={cssVars}
                >
                  <div
                    className="bio-link-icon w-[42px] h-[42px] rounded-xl flex items-center justify-center mr-4 shrink-0 overflow-hidden transition-all duration-300"
                    style={{
                      backgroundColor: theme.isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.05)',
                      color: brand.color,
                    }}
                  >
                    {link.thumbnailUrl ? (
                      <img
                        src={link.thumbnailUrl}
                        alt={link.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <SocialPlatformIcon platform={platformKey} className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold truncate">{link.title}</span>
                    {link.subtitle && (
                      <span
                        className="block text-xs mt-0.5 truncate"
                        style={{ color: theme.textSecondary }}
                      >
                        {link.subtitle}
                      </span>
                    )}
                  </div>
                  <ExternalLink
                    className="w-3.5 h-3.5 ml-3 shrink-0 transition-transform duration-300"
                    style={{ color: theme.textSecondary }}
                    aria-hidden="true"
                  />
                </a>
              );
            })
          )}
        </section>

        {/* Bottom Social Dock */}
        {activeDockSocials.length > 0 && (
          <footer
            className="flex justify-center flex-wrap gap-3.5 mt-[26px] pt-5"
            style={{ borderTop: `1px solid ${theme.cardBorder}` }}
          >
            {activeDockSocials.map((social) => {
              const rawVal = profile.socials[social.key as SocialPlatformKey] || '';
              const href = resolveSocialUrl(social.key, rawVal);
              const detectedKey =
                social.key === 'website' ? detectPlatformFromUrl(href) : social.key;
              const brand = PLATFORM_BRAND_STYLES[detectedKey] || PLATFORM_BRAND_STYLES.website;

              return (
                <a
                  key={social.key}
                  href={href}
                  target={href.startsWith('mailto:') ? undefined : '_blank'}
                  rel={href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                  title={social.label}
                  aria-label={social.label}
                  className="bio-dock-item w-[42px] h-[42px] rounded-[14px] flex items-center justify-center"
                  style={
                    {
                      '--brand-color': brand.color,
                      '--brand-shadow': brand.shadow,
                      backgroundColor: theme.btnBg,
                      border: `1px solid ${theme.cardBorder}`,
                      color: theme.textSecondary,
                    } as CSSProperties
                  }
                >
                  <SocialPlatformIcon platform={detectedKey} className="w-[18px] h-[18px]" />
                </a>
              );
            })}
          </footer>
        )}
      </div>

      {/* Copy Toast Notification */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 text-white text-xs font-semibold shadow-lg transition-all duration-300 ${
          showToast ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
        }`}
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>Đã sao chép liên kết trang!</span>
      </div>
    </>
  );
}
