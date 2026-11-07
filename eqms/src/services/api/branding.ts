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
  /** "#RRGGBB" colours of the text and icons of dropdown menu items; null or missing: built-in colours. */
  menuTextColor?: string | null;
  menuIconColor?: string | null;
  tableColumnDividers?: boolean;
  mainBackground?: PageBackground | null;
  authBackground?: PageBackground | null;
  /** Background of the Knowledge Base explorer: a colour or a gradient. */
  knowledgeBackground?: PageBackground | null;
  /** Machine value: center | top-right | top-left | bottom-right | bottom-left. */
  toastPosition?: 'center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** How long a system message stays on screen, in seconds (2 to 60). */
  toastDurationSeconds?: number;
  /** How the materials of a training are drawn: TABLE (default) or TILES. Chosen by the administrator. */
  trainingMaterialsLayout?: 'TABLE' | 'TILES';
  /** How the folders of the Knowledge Base are named: FULL (the name, default) or ABBREVIATION. Chosen by the administrator. */
  knowledgeFolderNames?: 'FULL' | 'ABBREVIATION';
  /** How the folders are named in the sidebar of the Knowledge Base (follows knowledgeFolderNames until the administrator chooses). */
  knowledgeSidebarFolderNames?: 'FULL' | 'ABBREVIATION';
  /** The Knowledge Base menu opens the Explorer in a new browser tab (true, also when nothing was set) or in the current tab. */
  knowledgeOpenInNewTab?: boolean;
  systemDisplayName: string;
  systemLogo: string;
  systemSidebarCollapsedLogo?: string;
  showSidebarUserProfile?: boolean;
  /** Administrator switch: the Knowledge Base menu opens the explorer experience in a new tab. */
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
