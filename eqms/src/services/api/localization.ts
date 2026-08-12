import { api } from './client';
import type { ApplicationFontFamily, SystemLocalizationSettings } from '@/config/localization';

export interface UserLocalizationPreferences extends Partial<SystemLocalizationSettings> {
  useSystemDefaults: boolean;
  fontFamily?: ApplicationFontFamily;
}

export const localizationApi = {
  getSystem: async (): Promise<SystemLocalizationSettings> => (await api.get<SystemLocalizationSettings>('/localization')).data,
  getMine: async (): Promise<UserLocalizationPreferences> => (await api.get<UserLocalizationPreferences>('/auth/me/localization-settings')).data,
  updateMine: async (preferences: UserLocalizationPreferences): Promise<UserLocalizationPreferences> =>
    (await api.put<UserLocalizationPreferences>('/auth/me/localization-settings', preferences)).data,
};
