import { api } from './client';

/** One saved column entry. `id` is the column id used by the table; order is the sort position. */
export interface SavedColumnPreference {
  id: string;
  visible: boolean;
  order: number;
  pinned: boolean;
}

/**
 * The server accepts a table key of lower-case letters, digits, dot, underscore and hyphen (1 to 120). A screen may name its table in camel case ("reportDefinitions"); the key that
 * goes to the server is the same name in lower case with a hyphen where a capital begins ("report-definitions"), so a layout saved by one screen is always found by it.
 * A key that is already in the accepted form is not changed.
 */
export const serverTableKey = (tableKey: string): string => tableKey.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/** Per-user column layouts. The server only ever returns the signed-in user's own rows. */
export const tablePreferencesApi = {
  get: async (tableKey: string): Promise<SavedColumnPreference[]> => {
    const response = await api.get<SavedColumnPreference[]>(`/user-table-preferences/${encodeURIComponent(serverTableKey(tableKey))}`);
    return Array.isArray(response.data) ? response.data : [];
  },

  save: async (tableKey: string, preferences: SavedColumnPreference[]): Promise<void> => {
    await api.put(`/user-table-preferences/${encodeURIComponent(serverTableKey(tableKey))}`, preferences);
  },

  reset: async (tableKey: string): Promise<void> => {
    await api.delete(`/user-table-preferences/${encodeURIComponent(serverTableKey(tableKey))}`);
  },
};
