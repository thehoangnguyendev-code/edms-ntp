import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeApplicationLanguage } from '@/config/localization';
import { translate, translateLabel } from '@/i18n/catalog';
import {
  LANGUAGE_OPTIONS,
  languageCacheKey,
  readCachedLanguage,
  writeCachedLanguage,
} from '@/i18n/language';

describe('application language', () => {
  it('accepts only the supported languages and falls back to English', () => {
    expect(normalizeApplicationLanguage('vi')).toBe('vi');
    expect(normalizeApplicationLanguage(' VI ')).toBe('vi');
    expect(normalizeApplicationLanguage('en')).toBe('en');
    expect(normalizeApplicationLanguage('fr')).toBe('en');
    expect(normalizeApplicationLanguage(null)).toBe('en');
    expect(normalizeApplicationLanguage(undefined)).toBe('en');
  });

  it('offers the two tabs, each named in its own language', () => {
    expect(LANGUAGE_OPTIONS.map((option) => option.label)).toEqual(['Tiếng Việt', 'English']);
    expect(LANGUAGE_OPTIONS.map((option) => option.value)).toEqual(['vi', 'en']);
  });
});

describe('translation catalog', () => {
  it('returns the English fallback for English and for a key that is not translated', () => {
    expect(translate('en', 'shell.allItems', 'All Items')).toBe('All Items');
    expect(translate('vi', 'a.key.that.does.not.exist', 'Fallback')).toBe('Fallback');
  });

  it('returns the Vietnamese copy when it exists', () => {
    expect(translate('vi', 'shell.allItems', 'All Items')).toBe('Tất cả mục');
    expect(translate('vi', 'knowledge.documents', 'Documents')).toBe('Tài liệu');
  });

  it('translates data-driven labels without changing an unknown label', () => {
    expect(translateLabel('vi', 'Document Control')).toBe('Kiểm soát tài liệu');
    expect(translateLabel('vi', 'A custom navigation name')).toBe('A custom navigation name');
    expect(translateLabel('en', 'Document Control')).toBe('Document Control');
  });
});

describe('per-user language cache', () => {
  beforeEach(() => window.localStorage.clear());

  it('keys the cache by account and never shares it between accounts', () => {
    expect(languageCacheKey('user-a')).not.toBe(languageCacheKey('user-b'));
    writeCachedLanguage('user-a', 'vi');
    expect(readCachedLanguage('user-a')).toBe('vi');
    expect(readCachedLanguage('user-b')).toBeNull();
    expect(readCachedLanguage()).toBeNull();
  });

  it('accepts only a supported value from storage', () => {
    window.localStorage.setItem(languageCacheKey('user-a'), 'fr');
    expect(readCachedLanguage('user-a')).toBe('en');
  });
});
