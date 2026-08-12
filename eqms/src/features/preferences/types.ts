import { AppSettings, NotificationSettings, DisplaySettings } from '@/types';

export interface PreferencesState extends AppSettings {
  // We can add more specific fields if needed
}

export type PreferenceTabId = 'localization' | 'notifications' | 'security';
