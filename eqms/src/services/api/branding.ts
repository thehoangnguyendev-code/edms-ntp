import { api } from './client';

/** Shown in the Dashboard top bar when the administrator has not set a header title. */
export const DEFAULT_SYSTEM_HEADER_TITLE = 'Electronic Quality Management Software';

export interface PublicBranding {
  compactDesktopFilters?: boolean;
  /** Machine value: center | top-right | top-left | bottom-right | bottom-left. */
  toastPosition?: 'center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  systemDisplayName: string;
  systemLogo: string;
  systemSidebarCollapsedLogo?: string;
  showSidebarUserProfile?: boolean;
  /** Administrator switch: the Knowledge Base menu opens the explorer experience in a new tab. */
  knowledgeExplorerEnabled?: boolean;
  systemFavicon: string;
  systemFooter: string;
  /** Text of the Dashboard top bar; empty or missing means DEFAULT_SYSTEM_HEADER_TITLE. */
  systemHeaderTitle?: string;
  navigationLabelOverrides?: Record<string, string>;
}

export const brandingApi = {
  get: async (): Promise<PublicBranding> => (await api.get<PublicBranding>('/branding')).data,
};
