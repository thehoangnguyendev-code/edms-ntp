import {
  DEFAULT_APPLICATION_LANGUAGE,
  normalizeApplicationLanguage,
  type ApplicationLanguage,
} from '@/config/localization';

/** The two tabs of the sidebar switcher. Each label is written in its own language, so it never needs a translation. */
export const LANGUAGE_OPTIONS = [
  { value: 'vi', label: 'Tiếng Việt', short: 'VI' },
  { value: 'en', label: 'English', short: 'EN' },
] as const satisfies ReadonlyArray<{ value: ApplicationLanguage; label: string; short: string }>;

/**
 * A per-user cache, only there to paint the right language on the first frame after sign-in. The server preference is
 * the source of truth and replaces it as soon as it is read. It is never shared between two accounts on one browser.
 */
const CACHE_PREFIX = 'eqms.ui.language';
/** The language the sign-in screen uses before it knows who is signing in. It is not an account preference. */
const LAST_LANGUAGE_KEY = 'eqms.ui.language.last';

export const languageCacheKey = (userId?: string | null): string => `${CACHE_PREFIX}.${userId || 'anonymous'}`;

export const readCachedLanguage = (userId?: string | null): ApplicationLanguage | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(languageCacheKey(userId));
    return value ? normalizeApplicationLanguage(value) : null;
  } catch {
    return null;
  }
};

export const writeCachedLanguage = (userId: string | undefined | null, language: ApplicationLanguage): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(languageCacheKey(userId), language);
  } catch {
    // storage unavailable: the server preference still applies on the next sign-in
  }
};

export const readLastLanguage = (): ApplicationLanguage | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(LAST_LANGUAGE_KEY);
    return value ? normalizeApplicationLanguage(value) : null;
  } catch {
    return null;
  }
};

export const writeLastLanguage = (language: ApplicationLanguage): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_LANGUAGE_KEY, language);
  } catch {
    // nothing to remember
  }
};

export const clearCachedLanguage = (userId?: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(languageCacheKey(userId));
  } catch {
    // nothing to clear
  }
};

export const defaultLanguage = (): ApplicationLanguage => DEFAULT_APPLICATION_LANGUAGE;
