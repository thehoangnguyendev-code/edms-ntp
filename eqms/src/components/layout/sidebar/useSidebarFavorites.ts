import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SIDEBAR_FAVORITES_PREFERENCE, userUiPreferencesApi, type SidebarFavoritesPreference } from '@/services/api/userUiPreferences';

/**
 * The menu entries a user starred in the sidebar.
 *
 * They belong to the user and are kept on the server, so they follow the user to any browser and survive signing out and in.
 * This browser keeps a copy only so the Favourite tab is right on the first paint; the server's answer wins once it arrives,
 * unless the user has already starred something in this session (a slow answer must not undo that).
 */

const CACHE_PREFIX = 'eqms:sidebar-favorites:';

const readCache = (userId: string | undefined): string[] => {
  if (!userId) return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CACHE_PREFIX + userId) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const writeCache = (userId: string | undefined, ids: string[]) => {
  if (!userId) return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(ids));
  } catch {
    // Storage denied (private window): only the first-paint copy is lost.
  }
};

export interface SidebarFavorites {
  /** Starred ids, in the order they were starred. */
  ids: readonly string[];
  isFavorite: (id: string) => boolean;
  /**
   * Stars a menu entry together with the entries beneath it (pass the entry's own id first, then its descendants), or removes
   * them all when the entry is already starred.
   */
  toggle: (branchIds: readonly string[]) => void;
}

export const useSidebarFavorites = (userId: string | undefined): SidebarFavorites => {
  const [ids, setIds] = useState<string[]>(() => readCache(userId));
  const chosenHere = useRef(false);

  useEffect(() => {
    chosenHere.current = false;
    setIds(readCache(userId));
    if (!userId) return undefined;
    let cancelled = false;
    userUiPreferencesApi
      .get<SidebarFavoritesPreference>(SIDEBAR_FAVORITES_PREFERENCE)
      .then((saved) => {
        // No saved list means the user never starred anything on any browser: keep what is shown.
        if (cancelled || chosenHere.current || !Array.isArray(saved.ids)) return;
        setIds(saved.ids);
        writeCache(userId, saved.ids);
      })
      .catch(() => {
        // The server could not be reached: this browser's copy stays in use.
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const idsRef = useRef(ids);
  idsRef.current = ids;

  const toggle = useCallback((branchIds: readonly string[]) => {
    const current = idsRef.current;
    const removing = branchIds.length > 0 && current.includes(branchIds[0]);
    const next = removing
      ? current.filter((value) => !branchIds.includes(value))
      : [...current, ...branchIds.filter((value) => !current.includes(value))];
    chosenHere.current = true;
    idsRef.current = next;
    setIds(next);
    writeCache(userId, next);
    if (userId) {
      userUiPreferencesApi.save<SidebarFavoritesPreference>(SIDEBAR_FAVORITES_PREFERENCE, { ids: next }).catch((error) => {
        // The choice stands for this session and this browser; it reaches the server with the next change.
        console.warn('Could not save the sidebar favourites', error);
      });
    }
  }, [userId]);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  return useMemo(() => ({ ids, isFavorite, toggle }), [ids, isFavorite, toggle]);
};
