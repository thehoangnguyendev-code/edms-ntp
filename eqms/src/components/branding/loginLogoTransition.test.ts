import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureLoginLogo, startLoginLogoTransition, subscribeLoginLogoTransition } from './loginLogoTransition';

describe('login logo transition', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); });

  it('does not animate when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const listener = vi.fn();
    window.addEventListener('eqms:login-logo-transition', listener);
    startLoginLogoTransition({ src: '/logo.png', left: 0, top: 0, width: 100, height: 40 });
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('eqms:login-logo-transition', listener);
  });

  it('captures the displayed logo and moves it to the sidebar only once', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    document.body.innerHTML = '<div data-login-logo><img src="/logo.png"></div><div id="target"><img src="/logo.png"></div>';
    const [source, target] = document.querySelectorAll('img');
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 120, width: 120, height: 40 } as DOMRect);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ left: 20, top: 10, width: 90, height: 30 } as DOMRect);
    const animate = vi.fn().mockReturnValue({ finished: Promise.resolve(), cancel: vi.fn() });
    HTMLImageElement.prototype.animate = animate;
    const unsubscribe = subscribeLoginLogoTransition(document.querySelector('#target')!);
    startLoginLogoTransition(captureLoginLogo());
    await vi.waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(target.style.visibility).toBe(''));
    unsubscribe();
  });

  it('survives the mount and immediate cleanup performed by Strict Mode', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    document.body.innerHTML = '<div id="target"><img src="/logo.png"></div>';
    const target = document.querySelector<HTMLDivElement>('#target')!;
    const image = target.querySelector('img')!;
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({ left: 20, top: 10, width: 90, height: 30 } as DOMRect);
    const animate = vi.fn().mockReturnValue({ finished: Promise.resolve(), cancel: vi.fn() });
    HTMLImageElement.prototype.animate = animate;
    startLoginLogoTransition({ src: '/logo.png', left: 100, top: 120, width: 120, height: 40 });
    const cleanupFirstMount = subscribeLoginLogoTransition(target);
    cleanupFirstMount();
    const cleanupSecondMount = subscribeLoginLogoTransition(target);
    await vi.waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
    cleanupSecondMount();
  });

  it('covers the layout until the logo arrives and then reveals it', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    document.body.innerHTML = '<div id="target"><img src="/logo.png"></div>';
    const target = document.querySelector<HTMLDivElement>('#target')!;
    const image = target.querySelector('img')!;
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({ left: 20, top: 10, width: 90, height: 30 } as DOMRect);
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => { finish = resolve; });
    HTMLImageElement.prototype.animate = vi.fn().mockReturnValue({ finished, cancel: vi.fn() });
    const cleanup = subscribeLoginLogoTransition(target);
    startLoginLogoTransition({ src: '/logo.png', left: 100, top: 120, width: 120, height: 40 });
    const overlay = document.querySelector<HTMLDivElement>('div[aria-hidden="true"]')!;
    expect(overlay).toBeInTheDocument();
    await vi.waitFor(() => expect(image.style.visibility).toBe('hidden'));
    expect(overlay).toBeInTheDocument();
    finish();
    await vi.waitFor(() => expect(overlay).not.toBeInTheDocument());
    expect(image.style.visibility).toBe('');
    cleanup();
  });
});
