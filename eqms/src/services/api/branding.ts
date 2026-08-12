import { api } from './client';

export interface PublicBranding {
  systemDisplayName: string;
  systemLogo: string;
  systemSidebarCollapsedLogo?: string;
  systemFavicon: string;
  systemFooter: string;
  navigationLabelOverrides?: Record<string, string>;
}

export const brandingApi = {
  get: async (): Promise<PublicBranding> => (await api.get<PublicBranding>('/branding')).data,
};
