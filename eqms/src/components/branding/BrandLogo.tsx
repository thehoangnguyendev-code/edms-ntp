import { useEffect, useState } from 'react';
import fallbackLogo from '@/assets/images/logo_nobg.png';
import { brandingApi, type PublicBranding } from '@/services/api/branding';
import { createSharedPollingResource } from '@/services/sharedPollingResource';
import { subscribeNotificationRealtime } from '@/features/notifications/notificationRealtime';

const BRANDING_UPDATED_EVENT = 'eqms:branding-updated';
const BRANDING_REFRESH_INTERVAL_MS = 30_000;
const BRANDING_CACHE_KEY = 'eqms:branding-cache';
const FALLBACK: PublicBranding = { systemDisplayName: 'EQMS', systemLogo: '', systemFavicon: '', systemFooter: '© {year} Ngoc Thien Pharma. All rights reserved.' };

// On a hard refresh, the shared polling resource always starts empty (it's an in-memory cache,
// reset by the page reload) and only has real data once its first fetch resolves. Header and
// Sidebar both read showSidebarUserProfile from this same hook, and until that fetch resolves
// they can only assume `false` -- Header briefly renders the profile widget it was never supposed
// to (the setting is `true`), then it vanishes once the real value arrives and Sidebar takes over.
// Caching the last-known value in localStorage lets a returning visitor start from the CORRECT
// value immediately, before the network round-trip -- eliminating that visible flash for them
// (a first-ever visit with no cache yet still shows one, which is unavoidable).
const readCachedBranding = (): PublicBranding | null => {
  try {
    const raw = window.localStorage.getItem(BRANDING_CACHE_KEY);
    return raw ? (JSON.parse(raw) as PublicBranding) : null;
  } catch {
    return null;
  }
};
const writeCachedBranding = (branding: PublicBranding) => {
  try {
    window.localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(branding));
  } catch {
    // Private-browsing / storage-denied -- the flash-avoidance is best-effort only.
  }
};

function applyBrowserBranding(branding: PublicBranding) {
  if (branding.systemDisplayName?.trim()) document.title = branding.systemDisplayName.trim();
  let icon = document.querySelector<HTMLLinkElement>('link[data-eqms-branding-favicon]');
  if (!branding.systemFavicon?.trim()) {
    icon?.remove();
    return;
  }
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    icon.dataset.eqmsBrandingFavicon = 'true';
    document.head.appendChild(icon);
  }
  icon.href = branding.systemFavicon;
}

export function useBranding() {
  const [branding, setBranding] = useState<PublicBranding>(() => readCachedBranding() ?? FALLBACK);

  useEffect(() => {
    const unsubscribe = brandingResource.subscribe(() => {
      const next = brandingResource.getSnapshot();
      if (next) {
        setBranding(next);
        applyBrowserBranding(next);
        writeCachedBranding(next);
      }
    });
    const handleUpdated = () => void brandingResource.refresh();
    // The authenticated SSE stream is shared per browser. A configuration save emits this
    // invalidation only after the backend transaction commits, so every open user session
    // immediately obtains the new server-authoritative branding/layout settings.
    const unsubscribeRealtime = subscribeNotificationRealtime((event) => {
      if (event.type === 'branding-updated') {
        void brandingResource.refresh();
      }
    });
    window.addEventListener(BRANDING_UPDATED_EVENT, handleUpdated);
    const current = brandingResource.getSnapshot();
    if (current) setBranding(current);
    return () => {
      unsubscribe();
      unsubscribeRealtime();
      window.removeEventListener(BRANDING_UPDATED_EVENT, handleUpdated);
    };
  }, []);

  return branding;
}

const brandingResource = createSharedPollingResource(brandingApi.get, BRANDING_REFRESH_INTERVAL_MS);

export function BrandLogo({ className, alt, variant = 'default' }: { className?: string; alt?: string; variant?: 'default' | 'collapsedSidebar' }) {
  const { systemLogo, systemSidebarCollapsedLogo, systemDisplayName } = useBranding();
  const source = variant === 'collapsedSidebar'
    ? systemSidebarCollapsedLogo || systemLogo || fallbackLogo
    : systemLogo || fallbackLogo;
  return (
    <img
      src={source}
      alt={alt || `${systemDisplayName || 'EQMS'} logo`}
      className={className}
      onError={(event) => {
        if (event.currentTarget.src !== fallbackLogo) event.currentTarget.src = fallbackLogo;
      }}
    />
  );
}
