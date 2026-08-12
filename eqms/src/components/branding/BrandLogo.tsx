import { useEffect, useState } from 'react';
import fallbackLogo from '@/assets/images/logo_nobg.png';
import { brandingApi, type PublicBranding } from '@/services/api/branding';
import { createSharedPollingResource } from '@/services/sharedPollingResource';

const BRANDING_UPDATED_EVENT = 'eqms:branding-updated';
const BRANDING_REFRESH_INTERVAL_MS = 30_000;
const FALLBACK: PublicBranding = { systemDisplayName: 'EQMS', systemLogo: '', systemFavicon: '', systemFooter: '© {year} Ngoc Thien Pharma. All rights reserved.' };

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
  const [branding, setBranding] = useState<PublicBranding>(FALLBACK);

  useEffect(() => {
    const unsubscribe = brandingResource.subscribe(() => {
      const next = brandingResource.getSnapshot();
      if (next) {
        setBranding(next);
        applyBrowserBranding(next);
      }
    });
    const handleUpdated = () => void brandingResource.refresh();
    window.addEventListener(BRANDING_UPDATED_EVENT, handleUpdated);
    const current = brandingResource.getSnapshot();
    if (current) setBranding(current);
    return () => {
      unsubscribe();
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
