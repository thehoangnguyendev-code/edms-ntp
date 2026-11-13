import '@testing-library/jest-dom/vitest';

// No test reaches the CDN of the icon libraries: the newest icons are read from there while the application runs (see remoteIcons.tsx), and a test that wants them
// stubs fetch itself. Without this a test that opens the icon picker would make a real request.
const realFetch = globalThis.fetch?.bind(globalThis);
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('cdn.jsdelivr.net')) return Promise.reject(new TypeError('The icon CDN is not reached by the tests'));
  return realFetch ? realFetch(input, init) : Promise.reject(new TypeError('fetch is not available'));
}) as typeof fetch;
