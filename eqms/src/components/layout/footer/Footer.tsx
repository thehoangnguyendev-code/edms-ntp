import React from 'react';
import { useBranding } from '@/components/branding/BrandLogo';

export const Footer: React.FC = () => {
  const { systemFooter } = useBranding();
  const footerText = (systemFooter || '© {year} Ngoc Thien Pharma. All rights reserved.')
    .replaceAll('{year}', String(new Date().getFullYear()));

  return (
    <footer className="hidden md:block shrink-0 border-t border-slate-200 bg-white py-3">
      <div className="max-w-[1920px] mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-2 md:gap-3">
          {/* Left: Copyright */}
          <div className="text-center md:text-left">
            <p className="text-xs text-slate-600">
              {footerText}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
