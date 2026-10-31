import { api } from './client';
import type { PageBackground } from '@/config/page-background';

/** Shown in the Dashboard top bar when the administrator has not set a header title. */
/** The left footer when the administrator never set one. {year} is replaced by the current year. */
export const DEFAULT_FOOTER_LEFT = '© {year} Ngoc Thien Pharma. All rights reserved.';

export const DEFAULT_SYSTEM_HEADER_TITLE = 'Electronic Quality Management Software';

export interface PublicBranding {
  compactDesktopFilters?: boolean;
  alternatingRecordColors?: boolean;
  alternatingRecordColor?: string;
  mainBackground?: PageBackground | null;
  authBackground?: PageBackground | null;
  /** Machine value: center | top-right | top-left | bottom-right | bottom-left. */
  toastPosition?: 'center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** How long a system message stays on screen, in seconds (2 to 60). */
  toastDurationSeconds?: number;
  /** How the materials of a training are drawn: TABLE (default) or TILES. Chosen by the administrator. */
  trainingMaterialsLayout?: 'TABLE' | 'TILES';
  systemDisplayName: string;
  systemLogo: string;
  systemSidebarCollapsedLogo?: string;
  showSidebarUserProfile?: boolean;
  /** Administrator switch: the Knowledge Base menu opens the explorer experience in a new tab. */
  knowledgeExplorerEnabled?: boolean;
  systemFavicon: string;
  systemFooterLeft?: string | null;
  systemFooterRight?: string | null;
  footerShowOnDesktop?: boolean;
  footerShowOnMobile?: boolean;
  /** Text of the Dashboard top bar; empty or missing means DEFAULT_SYSTEM_HEADER_TITLE. */
  systemHeaderTitle?: string;
  navigationLabelOverrides?: Record<string, string>;
  /** Changes whenever the home-screen shortcut icon, colour or name changes; empty when the built-in icon is used. */
  appIconVersion?: string;
  appShortName?: string;
}

export const brandingApi = {
  get: async (): Promise<PublicBranding> => (await api.get<PublicBranding>('/branding')).data,
};
