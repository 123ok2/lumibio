export type ThemeId = 'matcha' | 'midnight' | 'citrus' | 'peach' | 'cobalt' | 'rose';
export type LayoutMode = 'stack' | 'bento';
export type ButtonRadius = 'sharp' | 'soft' | 'pill';
export type FontMood = 'editorial' | 'modern' | 'bold';
export type LinkKind = 'link' | 'featured' | 'music';

export type SocialPlatformKey =
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'threads'
  | 'facebook'
  | 'spotify'
  | 'discord'
  | 'zalo'
  | 'website';

export type SocialsMap = Partial<Record<SocialPlatformKey, string>>;

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  activeHandle: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BioProfile {
  handle: string;
  ownerId: string;
  displayName: string;
  tagline: string;
  category: string;
  location: string;
  avatarUrl: string;
  coverUrl: string;
  themeId: ThemeId;
  layoutMode: LayoutMode;
  buttonRadius: ButtonRadius;
  fontMood: FontMood;
  isPublished: boolean;
  viewCount: number;
  socials: SocialsMap;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BioLink {
  id: string;
  bioHandle: string;
  ownerId: string;
  title: string;
  subtitle: string;
  url: string;
  kind: LinkKind;
  thumbnailUrl: string;
  order: number;
  isActive: boolean;
  isPublished: boolean;
  clicks: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BioThemeSpec {
  id: ThemeId;
  name: string;
  description: string;
  canvasBg: string;
  cardBg: string;
  cardHoverBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  accentBg: string;
  accentText: string;
  socialBg: string;
  isDark: boolean;
  swatchColors: [string, string, string];
}

export const HANDLE_REGEX = /^[a-z0-9_-]{3,32}$/;
export const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export const LIMITS = {
  DISPLAY_NAME_MAX: 60,
  TAGLINE_MAX: 180,
  CATEGORY_MAX: 40,
  LOCATION_MAX: 40,
  URL_MAX: 500,
  AVATAR_DATA_MAX: 120000,
  THUMBNAIL_DATA_MAX: 50000,
  SOCIAL_MAX: 200,
  LINK_TITLE_MAX: 80,
  LINK_SUBTITLE_MAX: 120,
} as const;
