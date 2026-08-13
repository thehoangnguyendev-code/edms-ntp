import en from './en.json';
import vi from './vi.json';
import { useEffect, useState } from 'react';

export type SupportedLocale = 'en' | 'vi';
type TranslationValue = string | { [key: string]: TranslationValue };
type TranslationCatalog = Record<string, TranslationValue>;

const catalogs: Record<SupportedLocale, TranslationCatalog> = { en, vi };
let activeLocale: SupportedLocale = 'en';
const I18N_UPDATED_EVENT = 'eqms:i18n-updated';

export const normalizeLocale = (value?: string | null): SupportedLocale =>
  value?.trim().toLowerCase().startsWith('vi') ? 'vi' : 'en';

export const setI18nLanguage = (locale?: string | null) => {
  activeLocale = normalizeLocale(locale);
  if (typeof document !== 'undefined') document.documentElement.lang = activeLocale;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(I18N_UPDATED_EVENT));
};

export const getI18nLanguage = () => activeLocale;

const findValue = (catalog: TranslationCatalog, key: string): string | undefined => {
  const value = key.split('.').reduce<TranslationValue | undefined>((current, part) =>
    current && typeof current === 'object' ? current[part] : undefined, catalog);
  return typeof value === 'string' ? value : undefined;
};

export const t = (key: string, values: Record<string, string | number> = {}): string => {
  const template = findValue(catalogs[activeLocale], key) ?? findValue(catalogs.en, key) ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
};

/** Re-renders a component when the active UI language changes. */
export const useTranslation = () => {
  const [locale, setLocale] = useState<SupportedLocale>(getI18nLanguage());
  useEffect(() => {
    const sync = () => setLocale(getI18nLanguage());
    window.addEventListener(I18N_UPDATED_EVENT, sync);
    return () => window.removeEventListener(I18N_UPDATED_EVENT, sync);
  }, []);
  return { locale, t };
};
