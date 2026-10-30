import { useEffect, useRef } from 'react';
import { BrandLogo } from './BrandLogo';
import { subscribeLoginLogoTransition } from './loginLogoTransition';

export function SidebarLoginLogo({ className, variant }: { className?: string; variant?: 'default' | 'collapsedSidebar' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current ? subscribeLoginLogoTransition(ref.current) : undefined, []);
  return <div ref={ref} className="h-full w-full"><BrandLogo className={className} variant={variant} /></div>;
}
