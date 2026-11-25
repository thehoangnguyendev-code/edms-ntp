export { LanguageProvider, useLanguage } from './LanguageProvider';
export {
  LANGUAGE_OPTIONS,
  languageCacheKey,
  readCachedLanguage,
  writeCachedLanguage,
  clearCachedLanguage,
  readLastLanguage,
  writeLastLanguage,
} from './language';
export { translate, translateLabel, tr, trFormat, trPlural, setCatalogLanguage, getCatalogLanguage, VI_MESSAGES, VI_LABELS } from './catalog';
export type { ApplicationLanguage } from '@/config/localization';
