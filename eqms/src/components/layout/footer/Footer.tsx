import React from 'react';
import { useBranding } from '@/components/branding/BrandLogo';
import { DEFAULT_FOOTER_LEFT } from '@/services/api/branding';

export const Footer: React.FC = () => {
  const { systemFooterLeft, systemFooterRight, footerShowOnDesktop = true, footerShowOnMobile = false } = useBranding();
  if (!footerShowOnDesktop && !footerShowOnMobile) return null;

  const year = String(new Date().getFullYear());
  // Never set: the built-in copyright line. Set to empty by the administrator: nothing on that side.
  const left = (systemFooterLeft ?? DEFAULT_FOOTER_LEFT).replaceAll('{year}', year).trim();
  const right = (systemFooterRight ?? '').replaceAll('{year}', year).trim();
  if (!left && !right) return null;

  // Below md the switch for mobile decides, from md up the one for desktop and tablet.
  const visibility = `${footerShowOnMobile ? 'block' : 'hidden'} ${footerShowOnDesktop ? 'md:block' : 'md:hidden'}`;

  return (
    <footer className={`${visibility} shrink-0 border-t border-slate-200 bg-white py-3`}>
      <div className="max-w-[1920px] mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-1 text-center md:flex-row md:items-start md:justify-between md:gap-3">
          {left && <p className="min-w-0 text-center text-xs text-slate-600 md:text-left">{left}</p>}
          {right && <p className="min-w-0 text-center text-xs text-slate-600 md:ml-auto md:text-right">{right}</p>}
        </div>
      </div>
    </footer>
  );
};
