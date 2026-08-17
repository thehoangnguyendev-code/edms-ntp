/**
 * Global localization is owned by System Configuration. It is cached only to
 * keep formatting available during a transient network failure; it is never a
 * per-user preference.
 */
export const LOCALIZATION_STORAGE_KEY = 'eqms.system.localization';
export const LOCALIZATION_UPDATED_EVENT = 'eqms:localization-updated';

export const APPLICATION_FONT_FAMILIES = [
  'INTER',
  'GOOGLE_SANS',
  'GOOGLE_SANS_FLEX',
  'PLUS_JAKARTA_SANS',
  'COMFORTAA',
  'QUESTRIAL',
  'GOWUN_BATANG',
  'TIKTOK_SANS',
] as const;
export type ApplicationFontFamily = (typeof APPLICATION_FONT_FAMILIES)[number];

export const APPLICATION_FONT_OPTIONS = [
  { value: 'INTER', label: 'Inter' },
  { value: 'GOOGLE_SANS', label: 'Google Sans' },
  { value: 'GOOGLE_SANS_FLEX', label: 'Google Sans Flex' },
  { value: 'PLUS_JAKARTA_SANS', label: 'Plus Jakarta Sans' },
  { value: 'COMFORTAA', label: 'Comfortaa' },
  { value: 'QUESTRIAL', label: 'Questrial' },
  { value: 'GOWUN_BATANG', label: 'Gowun Batang' },
  { value: 'TIKTOK_SANS', label: 'TikTok Sans' },
] as const;

const FONT_STACKS: Record<ApplicationFontFamily, string> = {
  INTER: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
  GOOGLE_SANS: "'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
  GOOGLE_SANS_FLEX: "'Google Sans Flex', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
  PLUS_JAKARTA_SANS: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
  COMFORTAA: "'Comfortaa', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
  QUESTRIAL: "'Questrial', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
  GOWUN_BATANG: "'Gowun Batang', Georgia, 'Times New Roman', serif",
  TIKTOK_SANS: "'TikTok Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
};

export interface SystemLocalizationSettings {
  language: string;
  dateTimeFormat: string;
  timeZone: string;
  numberFormat: string;
  fontFamily: ApplicationFontFamily;
}

export const DEFAULT_LOCALIZATION_SETTINGS: SystemLocalizationSettings = {
  language: 'en',
  dateTimeFormat: 'DD/MM/YYYY HH:mm:ss',
  timeZone: 'Asia/Ho_Chi_Minh',
  numberFormat: 'en-US',
  fontFamily: 'INTER',
};

const normalizeFontFamily = (value: unknown): ApplicationFontFamily =>
  typeof value === 'string' && APPLICATION_FONT_FAMILIES.includes(value as ApplicationFontFamily)
    ? value as ApplicationFontFamily
    : DEFAULT_LOCALIZATION_SETTINGS.fontFamily;

export const readSystemLocalizationSettings = (): SystemLocalizationSettings => {
  if (typeof window === 'undefined') return DEFAULT_LOCALIZATION_SETTINGS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCALIZATION_STORAGE_KEY) || '{}') as Partial<SystemLocalizationSettings>;
    return { ...DEFAULT_LOCALIZATION_SETTINGS, ...parsed, language: 'en', fontFamily: normalizeFontFamily(parsed.fontFamily) };
  } catch {
    return DEFAULT_LOCALIZATION_SETTINGS;
  }
};

export const writeSystemLocalizationSettings = (settings: SystemLocalizationSettings) => {
  if (typeof window === 'undefined') return;
  const normalized = {
    ...DEFAULT_LOCALIZATION_SETTINGS,
    ...settings,
    language: 'en',
    fontFamily: normalizeFontFamily(settings.fontFamily),
  };
  window.localStorage.setItem(LOCALIZATION_STORAGE_KEY, JSON.stringify(normalized));
  document.documentElement.lang = normalized.language || 'en';
  document.documentElement.style.setProperty('--font-sans', FONT_STACKS[normalized.fontFamily]);
  window.dispatchEvent(new Event(LOCALIZATION_UPDATED_EVENT));
};
