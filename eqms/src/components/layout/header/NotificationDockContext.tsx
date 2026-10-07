import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NOTIFICATION_DOCK_PREFERENCE, userUiPreferencesApi, type NotificationDockPreference } from '@/services/api/userUiPreferences';

/**
 * Whether the notification list is pinned to the right-hand side of the layout instead of opening as a dropdown.
 *
 * The choice belongs to the user and is kept on the server, so it follows them to any browser and survives signing out and in.
 * This browser keeps a copy only so the layout is right on the first paint, before the server has answered; the server's answer
 * wins once it arrives. A pinned list needs room: below DOCK_MIN_WIDTH the dropdown is used, whatever the preference says.
 */

const CACHE_PREFIX = 'eqms:notification-dock:';
/** Narrowest window (px) in which a 22 rem panel leaves the page a usable width. */
export const DOCK_MIN_WIDTH = 1024;

export interface NotificationDockValue {
  /** The user's preference. */
  pinned: boolean;
  /** The window is wide enough to dock. */
  canDock: boolean;
  /** The list is actually shown at the side (preference and room). */
  docked: boolean;
  pin: () => void;
  unpin: () => void;
  /** Bumped when the bell is pressed while docked, so the dock can take focus instead of opening a second list. */
  focusRequest: number;
  requestFocus: () => void;
}

const INERT: NotificationDockValue = {
  pinned: false,
  canDock: false,
  docked: false,
  pin: () => undefined,
  unpin: () => undefined,
  focusRequest: 0,
  requestFocus: () => undefined,
};

const NotificationDockContext = createContext<NotificationDockValue>(INERT);

const readCache = (userId: string | undefined): boolean => {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(CACHE_PREFIX + userId) === 'pinned';
  } catch {
    return false;
  }
};

const writeCache = (userId: string | undefined, pinned: boolean) => {
  if (!userId) return;
  try {
    if (pinned) window.localStorage.setItem(CACHE_PREFIX + userId, 'pinned');
    else window.localStorage.removeItem(CACHE_PREFIX + userId);
  } catch {
    // Storage denied (private window): only the first-paint copy is lost.
  }
};

const fits = () => typeof window !== 'undefined' && window.innerWidth >= DOCK_MIN_WIDTH;

export const NotificationDockProvider: React.FC<{ userId?: string; children: React.ReactNode }> = ({ userId, children }) => {
  const [pinned, setPinned] = useState(() => readCache(userId));
  const [canDock, setCanDock] = useState(fits);
  const [focusRequest, setFocusRequest] = useState(0);
  /** True once the user has pinned or unpinned in this session: a slow server answer must not undo that. */
  const chosenHere = useRef(false);

  // Whoever is signed in: start from this browser's copy, then take the server's answer.
  useEffect(() => {
    chosenHere.current = false;
    setPinned(readCache(userId));
    if (!userId) return undefined;
    let cancelled = false;
    userUiPreferencesApi
      .get<NotificationDockPreference>(NOTIFICATION_DOCK_PREFERENCE)
      .then((saved) => {
        // No saved value means the user never chose on any browser: keep what is shown.
        if (cancelled || chosenHere.current || typeof saved.pinned !== 'boolean') return;
        setPinned(saved.pinned);
        writeCache(userId, saved.pinned);
      })
      .catch(() => {
        // The server could not be reached: this browser's copy stays in use.
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const update = () => setCanDock(fits());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const choose = useCallback((next: boolean) => {
    chosenHere.current = true;
    setPinned(next);
    writeCache(userId, next);
    if (userId) {
      userUiPreferencesApi.save<NotificationDockPreference>(NOTIFICATION_DOCK_PREFERENCE, { pinned: next }).catch((error) => {
        // The choice stands for this session and this browser; it reaches the server with the next change.
        console.warn('Could not save the notification dock preference', error);
      });
    }
  }, [userId]);

  const pin = useCallback(() => choose(true), [choose]);
  const unpin = useCallback(() => choose(false), [choose]);
  const requestFocus = useCallback(() => setFocusRequest((value) => value + 1), []);

  const value = useMemo<NotificationDockValue>(
    () => ({ pinned, canDock, docked: pinned && canDock, pin, unpin, focusRequest, requestFocus }),
    [pinned, canDock, pin, unpin, focusRequest, requestFocus],
  );

  return <NotificationDockContext.Provider value={value}>{children}</NotificationDockContext.Provider>;
};

/** Safe without a provider: the dock is simply never used. */
export const useNotificationDock = () => useContext(NotificationDockContext);
