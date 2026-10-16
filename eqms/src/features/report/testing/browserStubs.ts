/**
 * Browser APIs that jsdom lacks and that the shared table and drawers use. Report tests import this file; the shared test setup is not
 * changed, because other suites rely on these APIs being absent.
 */
const none = (): void => undefined;

if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null as null,
      addEventListener: none,
      removeEventListener: none,
      addListener: none,
      removeListener: none,
      dispatchEvent: (): boolean => false,
    })) as unknown as typeof window.matchMedia;
  }
  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }
}
