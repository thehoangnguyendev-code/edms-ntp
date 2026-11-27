import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { setCatalogLanguage } from './src/i18n/catalog';

// `tr` reads the last language painted by the provider; a test that switches language must not leak that state into
// the next test, which expects the English fallback.
beforeEach(() => setCatalogLanguage('en'));

// Each test starts a fresh view session. Persistence across unmount/Back is tested
// inside a test; an unrelated test must not inherit the previous one's active tab.
beforeEach(() => {
  for (const key of Object.keys(window.sessionStorage)) {
    if (key.startsWith('eqms.navigation.') || (key.startsWith('eqms.list.') && key.includes('.view:'))) {
      window.sessionStorage.removeItem(key);
    }
  }
});

// No test reaches the CDN of the icon libraries: the newest icons are read from there while the application runs (see remoteIcons.tsx), and a test that wants them
// stubs fetch itself. Without this a test that opens the icon picker would make a real request.
const realFetch = globalThis.fetch?.bind(globalThis);
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('cdn.jsdelivr.net')) return Promise.reject(new TypeError('The icon CDN is not reached by the tests'));
  return realFetch ? realFetch(input, init) : Promise.reject(new TypeError('fetch is not available'));
}) as typeof fetch;
