import { api } from './client';
import { NavItem } from '@/types';

export interface FlatMenuItem {
  id: string;
  label: string;
  icon: string | null;
  path: string;
  fullPath: string;
}

const navigationRequestCache = new Map<string, Promise<NavItem[]>>();
let navigationSnapshot: { expiresAt: number; value: NavItem[] } | null = null;

export const navigationApi = {
  getNavigation: async () => {
    const cacheKey = 'navigation';
    if (navigationSnapshot && navigationSnapshot.expiresAt > Date.now()) return navigationSnapshot.value;
    const cachedRequest = navigationRequestCache.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<NavItem[]>('/navigation')
      .then((response) => {
        navigationSnapshot = { expiresAt: Date.now() + 10000, value: response.data };
        return response.data;
      })
      .finally(() => {
        navigationRequestCache.delete(cacheKey);
      });

    navigationRequestCache.set(cacheKey, request);
    return request;
  },

  /** What waits for the signed-in person, by menu id. */
  // A signal of its own keeps the request out of the client's short cache and sharing of GETs: a read asked because something changed must reach the server.
  getTaskCounts: async () => (await api.get<{ counts: Record<string, number>; shared: Record<string, number> }>('/navigation/task-counts', { signal: new AbortController().signal })).data,

  searchNavigation: async (query: string) => {
    const response = await api.get<FlatMenuItem[]>(`/navigation/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }
};

/** Clear the short-lived navigation snapshot after an administrator changes labels. */
export const invalidateNavigationCache = () => {
  navigationSnapshot = null;
};
