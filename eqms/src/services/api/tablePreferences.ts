import { api } from './client';

/** One saved column entry. `id` is the column id used by the table; order is the sort position. */
export interface SavedColumnPreference {
  id: string;
  visible: boolean;
  order: number;
  pinned: boolean;
}

/** Per-user column layouts. The server only ever returns the signed-in user's own rows. */
export const tablePreferencesApi = {
  get: async (tableKey: string): Promise<SavedColumnPreference[]> => {
    const response = await api.get<SavedColumnPreference[]>(`/user-table-preferences/${encodeURIComponent(tableKey)}`);
    return Array.isArray(response.data) ? response.data : [];
  },

  save: async (tableKey: string, preferences: SavedColumnPreference[]): Promise<void> => {
    await api.put(`/user-table-preferences/${encodeURIComponent(tableKey)}`, preferences);
  },

  reset: async (tableKey: string): Promise<void> => {
    await api.delete(`/user-table-preferences/${encodeURIComponent(tableKey)}`);
  },
};
