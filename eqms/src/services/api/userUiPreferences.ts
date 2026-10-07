import { api } from './client';

/** Keys the server knows (UserUiPreferenceService); anything else is refused. */
export const NOTIFICATION_DOCK_PREFERENCE = 'notification-dock';

/** The notification list pinned to the side. `pinned` is absent until the user has chosen. */
export interface NotificationDockPreference {
  pinned?: boolean;
}

/** The signed-in user's own interface preferences, kept on the server so they follow the user to any browser. */
export const userUiPreferencesApi = {
  get: async <T extends object>(key: string): Promise<T> => {
    const response = await api.get<T>(`/user-ui-preferences/${encodeURIComponent(key)}`);
    return (response.data ?? {}) as T;
  },

  save: async <T extends object>(key: string, value: T): Promise<void> => {
    await api.put(`/user-ui-preferences/${encodeURIComponent(key)}`, value);
  },
};
