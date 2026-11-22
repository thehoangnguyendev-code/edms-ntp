import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { localizationApi, type UserLocalizationPreferences } from '@/services/api/localization';
import {
  LOCALIZATION_UPDATED_EVENT,
  normalizeApplicationLanguage,
  readSystemLocalizationSettings,
  writeSystemLocalizationSettings,
  type ApplicationLanguage,
} from '@/config/localization';
import { readCachedLanguage, readLastLanguage, writeCachedLanguage, writeLastLanguage } from './language';
import { setCatalogLanguage, translate, translateLabel } from './catalog';

interface LanguageContextValue {
  language: ApplicationLanguage;
  /** Switch the interface language now and keep it on the signed-in account. */
  setLanguage: (language: ApplicationLanguage) => Promise<void>;
  /** UI copy by key, with the English copy as the fallback. */
  t: (key: string, fallback: string) => string;
  /** Data-driven labels (navigation names and other server text) by their English text. */
  tLabel: (english: string) => string;
}

/** Safe outside a provider (unit tests, isolated components): English, and every key falls back to its own copy. */
const fallbackContext: LanguageContextValue = {
  language: 'en',
  setLanguage: async () => undefined,
  t: (_key, fallback) => fallback,
  tLabel: (english) => english,
};

const LanguageContext = createContext<LanguageContextValue>(fallbackContext);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id;
  const [language, setLanguageState] = useState<ApplicationLanguage>(() =>
    readCachedLanguage(userId) ?? readLastLanguage() ?? normalizeApplicationLanguage(readSystemLocalizationSettings().language)
  );
  const preferencesRef = useRef<UserLocalizationPreferences | null>(null);
  // `tr` is used by copy that does not consume this context: set it before the subtree renders.
  setCatalogLanguage(language);

  const apply = useCallback((next: ApplicationLanguage, id?: string | null, rememberForSignIn = true) => {
    setCatalogLanguage(next);
    setLanguageState(next);
    if (typeof document !== 'undefined') document.documentElement.lang = next;
    if (id) writeCachedLanguage(id, next);
    if (rememberForSignIn) writeLastLanguage(next);
  }, []);

  // Sign-in loads the account's choice; sign-out returns to the language of the installation.
  useEffect(() => {
    let alive = true;
    preferencesRef.current = null;
    if (!isAuthenticated || !userId) {
      // Before sign-in the screen uses the last language this person chose; it must not overwrite that memory.
      apply(readLastLanguage() ?? normalizeApplicationLanguage(readSystemLocalizationSettings().language), undefined, false);
      return () => { alive = false; };
    }
    const cached = readCachedLanguage(userId);
    if (cached) apply(cached, userId);
    void localizationApi.getMine()
      .then((preferences) => {
        if (!alive) return;
        preferencesRef.current = preferences;
        const stored = normalizeApplicationLanguage(preferences.language ?? readSystemLocalizationSettings().language);
        apply(stored, userId);
      })
      .catch(() => {
        // keep the cached (or installation) language; the next sign-in tries again
      });
    return () => { alive = false; };
  }, [apply, isAuthenticated, userId]);

  // The system localization loader can refresh the personal preference; follow it without a second request.
  useEffect(() => {
    const onUpdated = () => {
      // Before sign-in the installation settings must not replace the last language this person chose.
      const next = !isAuthenticated
        ? readLastLanguage() ?? normalizeApplicationLanguage(readSystemLocalizationSettings().language)
        : normalizeApplicationLanguage(readSystemLocalizationSettings().language);
      setLanguageState((current) => (current === next ? current : next));
      if (typeof document !== 'undefined') document.documentElement.lang = next;
    };
    window.addEventListener(LOCALIZATION_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(LOCALIZATION_UPDATED_EVENT, onUpdated);
  }, [isAuthenticated]);

  const setLanguage = useCallback(async (nextLanguage: ApplicationLanguage) => {
    const next = normalizeApplicationLanguage(nextLanguage);
    apply(next, userId);
    if (!isAuthenticated) {
      writeSystemLocalizationSettings({ ...readSystemLocalizationSettings(), language: next });
      return;
    }
    try {
      const current = preferencesRef.current ?? await localizationApi.getMine();
      const saved = await localizationApi.updateMine({ ...current, language: next });
      preferencesRef.current = saved;
      const savedLanguage = normalizeApplicationLanguage(saved.language);
      writeCachedLanguage(userId, savedLanguage);
      // Only now tell the loader to refresh: a refresh before the write reached the server would read the old value back.
      writeSystemLocalizationSettings({ ...readSystemLocalizationSettings(), language: savedLanguage });
    } catch {
      // The per-user cache keeps the choice on this device; the next sign-in retries the server write.
    }
  }, [apply, isAuthenticated, userId]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key, fallback) => translate(language, key, fallback),
    tLabel: (english) => translateLabel(language, english),
  }), [language, setLanguage]);

  // A new prop on the root child makes the whole subtree render again when the language changes, so `tr` copy updates
  // without unmounting the page and losing what the person has typed.
  const content = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, { 'data-language': language })
    : children;
  return <LanguageContext.Provider value={value}>{content}</LanguageContext.Provider>;
};

/** The current interface language and its translation helpers. */
export const useLanguage = (): LanguageContextValue => useContext(LanguageContext);
