import { api } from './client';

export interface PublicBranding {
  systemDisplayName: string;
  systemLogo: string;
  systemSidebarCollapsedLogo?: string;
  showSidebarUserProfile?: boolean;
  /** Administrator switch: the Knowledge Base menu opens the explorer experience in a new tab. */
  knowledgeExplorerEnabled?: boolean;
  systemFavicon: string;
  systemFooter: string;
  navigationLabelOverrides?: Record<string, string>;
}

export const brandingApi = {
  get: async (): Promise<PublicBranding> => (await api.get<PublicBranding>('/branding')).data,
};
