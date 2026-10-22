import { useEffect, useRef } from 'react';
import { useBranding } from './BrandLogo';

export const PWA_MANIFEST_PATH = '/pwa/manifest.webmanifest';
export const PWA_APPLE_ICON_PATH = '/pwa/icon/apple-touch-icon.png';

/**
 * Keeps what a phone reads when someone adds the application to the home screen in step with the administrator's choice: the manifest (name and icons for
 * Android), the touch icon and the label (iOS). The branding is the same one the rest of the application uses, so a save in Configuration reaches every open
 * session at once and the next "Add to Home Screen" gets the new icon.
 *
 * The manifest address never changes (a phone treats a new address as a different app); to make the browser read it again, the link element is replaced. A
 * shortcut that is already on a phone keeps its icon until the phone refreshes it: Android does so by itself, iOS never does.
 */
export function PwaBranding() {
  const branding = useBranding();
  const version = branding.appIconVersion || '';
  const label = (branding.appShortName || branding.systemDisplayName || 'EQMS').trim();
  const firstRun = useRef(true);

  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!firstRun.current || !manifest) {
      manifest?.remove();
      const next = document.createElement('link');
      next.rel = 'manifest';
      next.href = PWA_MANIFEST_PATH;
      document.head.appendChild(next);
    }
    firstRun.current = false;

    let touch = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!touch) {
      touch = document.createElement('link');
      touch.rel = 'apple-touch-icon';
      document.head.appendChild(touch);
    }
    touch.href = version ? `${PWA_APPLE_ICON_PATH}?v=${encodeURIComponent(version)}` : PWA_APPLE_ICON_PATH;
  }, [version]);

  useEffect(() => {
    let title = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (!title) {
      title = document.createElement('meta');
      title.name = 'apple-mobile-web-app-title';
      document.head.appendChild(title);
    }
    title.content = label;
  }, [label]);

  return null;
}
