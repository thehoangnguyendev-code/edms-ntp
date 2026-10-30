type LogoSnapshot = { src: string; left: number; top: number; width: number; height: number };

const eventName = 'eqms:login-logo-transition';
type Transition = { logo: LogoSnapshot; expires: number; overlay: HTMLDivElement; ghost: HTMLImageElement; timeout: number };
let pending: Transition | null = null;

function removeTransition(transition: Transition) {
  clearTimeout(transition.timeout);
  transition.overlay.remove();
  if (pending === transition) pending = null;
}

export function captureLoginLogo(): LogoSnapshot | null {
  const image = document.querySelector<HTMLImageElement>('[data-login-logo] img');
  if (!image) return null;
  const rect = image.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return { src: image.currentSrc || image.src, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

export function startLoginLogoTransition(logo: LogoSnapshot | null) {
  if (!logo || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (pending) removeTransition(pending);
  const overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  Object.assign(overlay.style, { position: 'fixed', inset: '0', background: '#fff', zIndex: '9999' });
  const ghost = document.createElement('img');
  ghost.src = logo.src;
  ghost.alt = '';
  Object.assign(ghost.style, {
    position: 'fixed', left: `${logo.left}px`, top: `${logo.top}px`,
    width: `${logo.width}px`, height: `${logo.height}px`, objectFit: 'contain',
    transformOrigin: 'top left', pointerEvents: 'none',
  });
  overlay.appendChild(ghost);
  document.body.appendChild(overlay);
  const transition: Transition = { logo, expires: Date.now() + 8000, overlay, ghost, timeout: 0 };
  transition.timeout = window.setTimeout(() => removeTransition(transition), 8000);
  pending = transition;
  window.dispatchEvent(new Event(eventName));
}

export function subscribeLoginLogoTransition(target: HTMLElement) {
  let animation: Animation | undefined;
  let active: Transition | undefined;
  let frame: number | undefined;
  let disposed = false;
  const run = () => {
    frame = undefined;
    if (disposed) return;
    if (!pending) return;
    if (pending.expires < Date.now()) { removeTransition(pending); return; }
    const image = target.querySelector('img');
    const rect = image?.getBoundingClientRect();
    if (!image || !rect?.width || !rect.height) {
      frame = requestAnimationFrame(run);
      return;
    }
    if (typeof image.animate !== 'function') { removeTransition(pending); return; }
    active = pending;
    const { logo, ghost, overlay } = active;
    pending = null;
    image.style.visibility = 'hidden';
    animation = ghost.animate([
      { transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
      { transform: `translate(${rect.left - logo.left}px, ${rect.top - logo.top}px) scale(${rect.width / logo.width}, ${rect.height / logo.height})`, opacity: 1 },
    ], { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });
    const transition = active;
    void animation.finished.then(() => {
      image.style.visibility = '';
      if (typeof overlay.animate !== 'function') { removeTransition(transition); return; }
      const fade = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' });
      void fade.finished.catch(() => {}).finally(() => removeTransition(transition));
    }).catch(() => { image.style.visibility = ''; removeTransition(transition); });
  };
  const schedule = () => {
    if (frame === undefined) frame = requestAnimationFrame(run);
  };
  window.addEventListener(eventName, schedule);
  schedule();
  return () => {
    disposed = true;
    window.removeEventListener(eventName, schedule);
    if (frame !== undefined) cancelAnimationFrame(frame);
    animation?.cancel();
    if (active) removeTransition(active);
    const image = target.querySelector('img');
    if (image) image.style.visibility = '';
  };
}
