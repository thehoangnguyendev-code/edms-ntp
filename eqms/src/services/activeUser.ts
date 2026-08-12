/**
 * Tracks which user is currently logged in, in a form pure (non-React) utility modules
 * (e.g. src/utils/format.ts) can read synchronously without importing AuthContext.
 * Kept in sync with AuthContext's `user` state — see the effect in AuthContext.tsx.
 */

const ACTIVE_USER_ID_KEY = 'eqms.active-user-id';

export const getActiveUserId = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(ACTIVE_USER_ID_KEY);
};

export const setActiveUserId = (userId: string) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(ACTIVE_USER_ID_KEY, userId);
};

export const clearActiveUserId = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(ACTIVE_USER_ID_KEY);
};
