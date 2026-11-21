import type { BioLink, BioProfile, SocialPlatformKey, ThemeId } from '../types/bio';
import type { ExtendedPlatformKey } from '../components/SocialIcons';

export const STUDIO_AVATARS = [
  {
    id: 'linh',
    label: 'Thảo Linh',
    url: '/src/assets/images/creator_avatar_linh_1795263909466.jpg',
  },
  {
    id: 'khang',
    label: 'Minh Khang',
    url: '/src/assets/images/creator_avatar_khang_1795263908347.jpg',
  },
  {
    id: 'vy',
    label: 'Khánh Vy',
    url: '/src/assets/images/creator_avatar_vy_1795263908484.jpg',
  },
];

export interface GlassThemeSpec {
  id: ThemeId;
  name: string;
  isDark: boolean;
  bgColor: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  btnBg: string;
  btnHover: string;
  orbColors: [string, string, string];
}

export const GLASS_THEMES: Record<ThemeId, GlassThemeSpec> = {
  midnight: {
    id: 'midnight',
    name: 'Neon Tối (Mặc định)',
    isDark: true,
    bgColor: '#09090b',
    cardBg: 'rgba(24, 24, 27, 0.65)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    textPrimary: '#fafafa',
    textSecondary: '#a1a1aa',
    btnBg: 'rgba(39, 39, 42, 0.5)',
    btnHover: 'rgba(63, 63, 70, 0.7)',
    orbColors: ['#3b82f6', '#8b5cf6', '#ec4899'],
  },
  cobalt: {
    id: 'cobalt',
    name: 'Kính Sáng',
    isDark: false,
    bgColor: '#f4f4f5',
    cardBg: 'rgba(255, 255, 255, 0.78)',
    cardBorder: 'rgba(0, 0, 0, 0.08)',
    textPrimary: '#18181b',
    textSecondary: '#52525b',
    btnBg: 'rgba(244, 244, 245, 0.85)',
    btnHover: 'rgba(228, 228, 231, 0.95)',
    orbColors: ['#60a5fa', '#a78bfa', '#f472b6'],
  },
  rose: {
    id: 'rose',
    name: 'Hồng Neon',
    isDark: true,
    bgColor: '#0c080c',
    cardBg: 'rgba(28, 18, 26, 0.68)',
    cardBorder: 'rgba(255, 255, 255, 0.09)',
    textPrimary: '#fdf2f8',
    textSecondary: '#c4b5c7',
    btnBg: 'rgba(48, 30, 44, 0.55)',
    btnHover: 'rgba(72, 44, 66, 0.75)',
    orbColors: ['#ec4899', '#f43f5e', '#a855f7'],
  },
  peach: {
    id: 'peach',
    name: 'Hoàng Hôn',
    isDark: true,
    bgColor: '#0d0907',
    cardBg: 'rgba(28, 21, 18, 0.68)',
    cardBorder: 'rgba(255, 255, 255, 0.09)',
    textPrimary: '#fff7ed',
    textSecondary: '#c7b2a3',
    btnBg: 'rgba(48, 36, 30, 0.55)',
    btnHover: 'rgba(74, 54, 44, 0.75)',
    orbColors: ['#f97316', '#ec4899', '#f59e0b'],
  },
  matcha: {
    id: 'matcha',
    name: 'Lục Bảo',
    isDark: true,
    bgColor: '#070b09',
    cardBg: 'rgba(16, 26, 21, 0.68)',
    cardBorder: 'rgba(255, 255, 255, 0.09)',
    textPrimary: '#ecfdf5',
    textSecondary: '#9cb5a8',
    btnBg: 'rgba(26, 44, 35, 0.55)',
    btnHover: 'rgba(38, 66, 52, 0.75)',
    orbColors: ['#10b981', '#06b6d4', '#3b82f6'],
  },
  citrus: {
    id: 'citrus',
    name: 'Băng Xanh',
    isDark: false,
    bgColor: '#f1f5f9',
    cardBg: 'rgba(255, 255, 255, 0.8)',
    cardBorder: 'rgba(15, 23, 42, 0.08)',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    btnBg: 'rgba(241, 245, 249, 0.9)',
    btnHover: 'rgba(226, 232, 240, 0.95)',
    orbColors: ['#38bdf8', '#818cf8', '#34d399'],
  },
};

export interface BrandStyleMeta {
  key: ExtendedPlatformKey;
  label: string;
  color: string;
  shadow: string;
}

export const PLATFORM_BRAND_STYLES: Record<ExtendedPlatformKey, BrandStyleMeta> = {
  facebook: { key: 'facebook', label: 'Facebook', color: '#1877F2', shadow: 'rgba(24, 119, 242, 0.35)' },
  tiktok: { key: 'tiktok', label: 'TikTok', color: '#ff0050', shadow: 'rgba(255, 0, 80, 0.35)' },
  youtube: { key: 'youtube', label: 'YouTube', color: '#FF0000', shadow: 'rgba(255, 0, 0, 0.35)' },
  zalo: { key: 'zalo', label: 'Zalo', color: '#0068FF', shadow: 'rgba(0, 104, 255, 0.35)' },
  github: { key: 'github', label: 'GitHub', color: '#8b5cf6', shadow: 'rgba(139, 92, 246, 0.35)' },
  instagram: { key: 'instagram', label: 'Instagram', color: '#E4405F', shadow: 'rgba(228, 64, 95, 0.4)' },
  telegram: { key: 'telegram', label: 'Telegram', color: '#26A5E4', shadow: 'rgba(38, 165, 228, 0.4)' },
  threads: { key: 'threads', label: 'Threads', color: '#71717a', shadow: 'rgba(113, 113, 122, 0.4)' },
  spotify: { key: 'spotify', label: 'Spotify', color: '#1DB954', shadow: 'rgba(29, 185, 84, 0.35)' },
  discord: { key: 'discord', label: 'Discord', color: '#5865F2', shadow: 'rgba(88, 101, 242, 0.35)' },
  mail: { key: 'mail', label: 'Email', color: '#EA4335', shadow: 'rgba(234, 67, 53, 0.4)' },
  website: { key: 'website', label: 'Website', color: '#8b5cf6', shadow: 'rgba(139, 92, 246, 0.35)' },
};

export function detectPlatformFromUrl(url: string): ExtendedPlatformKey {
  const lower = url.toLowerCase();
  if (lower.includes('facebook.com') || lower.includes('fb.com')) return 'facebook';
  if (lower.includes('tiktok.com')) return 'tiktok';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('zalo.me')) return 'zalo';
  if (lower.includes('github.com')) return 'github';
  if (lower.includes('instagram.com')) return 'instagram';
  if (lower.includes('t.me') || lower.includes('telegram.me')) return 'telegram';
  if (lower.includes('threads.net')) return 'threads';
  if (lower.includes('spotify.com')) return 'spotify';
  if (lower.includes('discord.gg') || lower.includes('discord.com')) return 'discord';
  if (lower.startsWith('mailto:')) return 'mail';
  return 'website';
}

export interface SocialDockConfig {
  key: SocialPlatformKey;
  label: string;
  placeholder: string;
}

export const SOCIAL_DOCK_PLATFORMS: SocialDockConfig[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
  { key: 'threads', label: 'Threads', placeholder: 'https://threads.net/@...' },
  { key: 'spotify', label: 'Spotify', placeholder: 'https://open.spotify.com/...' },
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/...' },
  { key: 'website', label: 'Telegram / Email / Web', placeholder: 'https://t.me/... hoặc mailto:...' },
];

export function resolveSocialUrl(key: SocialPlatformKey, rawValue: string): string {
  const val = rawValue.trim();
  if (!val) return '';
  if (/^(https?:\/\/|mailto:)/i.test(val)) return val;
  if (val.includes('@') && val.includes('.') && !val.startsWith('@')) {
    return `mailto:${val}`;
  }
  const cleanHandle = val.startsWith('@') ? val.slice(1) : val;
  switch (key) {
    case 'facebook':
      return `https://www.facebook.com/${cleanHandle}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${cleanHandle}`;
    case 'instagram':
      return `https://www.instagram.com/${cleanHandle}`;
    case 'youtube':
      return `https://www.youtube.com/@${cleanHandle}`;
    case 'threads':
      return `https://www.threads.net/@${cleanHandle}`;
    case 'spotify':
      return `https://open.spotify.com/search/${encodeURIComponent(cleanHandle)}`;
    case 'discord':
      return `https://discord.gg/${cleanHandle}`;
    case 'zalo':
      return `https://zalo.me/${cleanHandle}`;
    case 'website':
      return `https://${val}`;
  }
}

export const DEFAULT_TEMPLATE_PROFILE: BioProfile = {
  handle: 'minhanh',
  ownerId: 'template_default',
  displayName: 'Thảo Linh',
  tagline: '',
  category: '',
  location: '',
  avatarUrl: '/src/assets/images/creator_avatar_linh_1795263909466.jpg',
  coverUrl: '',
  themeId: 'midnight',
  layoutMode: 'stack',
  buttonRadius: 'soft',
  fontMood: 'modern',
  isPublished: true,
  viewCount: 0,
  socials: {
    instagram: 'https://instagram.com',
    threads: 'https://threads.net',
    discord: 'https://discord.gg',
    website: 'https://t.me',
  },
};

export const DEFAULT_TEMPLATE_LINKS: BioLink[] = [
  {
    id: 'tpl_fb',
    bioHandle: 'minhanh',
    ownerId: 'template_default',
    title: 'Facebook',
    subtitle: 'Kết nối & cập nhật hoạt động mới nhất',
    url: 'https://facebook.com',
    kind: 'link',
    thumbnailUrl: '',
    order: 0,
    isActive: true,
    isPublished: true,
    clicks: 0,
  },
  {
    id: 'tpl_tt',
    bioHandle: 'minhanh',
    ownerId: 'template_default',
    title: 'TikTok',
    subtitle: 'Video ngắn & chia sẻ sáng tạo',
    url: 'https://tiktok.com',
    kind: 'link',
    thumbnailUrl: '',
    order: 1,
    isActive: true,
    isPublished: true,
    clicks: 0,
  },
  {
    id: 'tpl_yt',
    bioHandle: 'minhanh',
    ownerId: 'template_default',
    title: 'YouTube',
    subtitle: 'Kênh video chính thức',
    url: 'https://youtube.com',
    kind: 'link',
    thumbnailUrl: '',
    order: 2,
    isActive: true,
    isPublished: true,
    clicks: 0,
  },
  {
    id: 'tpl_zalo',
    bioHandle: 'minhanh',
    ownerId: 'template_default',
    title: 'Zalo',
    subtitle: 'Nhắn tin & trao đổi trực tiếp',
    url: 'https://zalo.me',
    kind: 'link',
    thumbnailUrl: '',
    order: 3,
    isActive: true,
    isPublished: true,
    clicks: 0,
  },
  {
    id: 'tpl_gh',
    bioHandle: 'minhanh',
    ownerId: 'template_default',
    title: 'GitHub / Dự án',
    subtitle: 'Kho lưu trữ mã nguồn & sản phẩm số',
    url: 'https://github.com',
    kind: 'link',
    thumbnailUrl: '',
    order: 4,
    isActive: true,
    isPublished: true,
    clicks: 0,
  },
];
