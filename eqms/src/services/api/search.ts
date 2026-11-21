import { api } from './client';

/** One result of the global search. `path` is set only for a page of the menu and for a notification; any other kind is opened from its `id`. */
export interface GlobalSearchItem {
  id: string;
  /** The number a person quotes for the record (document number, training number, employee code...). Shown first. */
  code?: string | null;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  path?: string | null;
}

/** One kind of record. `unavailable` means this kind could not be searched this time (it is not "no results"). */
export interface GlobalSearchGroup {
  key: string;
  label: string;
  items: GlobalSearchItem[];
  total: number;
  unavailable: boolean;
}

export interface GlobalSearchAnswer {
  query: string;
  groups: GlobalSearchGroup[];
}

export const searchApi = {
  /**
   * The best few matches of every kind of record the signed-in person can open (pages, documents, revisions, copies, users, trainings, ...).
   * The server decides what the person may see; the screen only draws it. Pass `signal` to drop a request that a newer key has replaced.
   */
  globalSearch: async (q: string, signal?: AbortSignal): Promise<GlobalSearchAnswer> => {
    const response = await api.get<GlobalSearchAnswer>('/search/global', { params: { q }, signal });
    return response.data;
  },
};
