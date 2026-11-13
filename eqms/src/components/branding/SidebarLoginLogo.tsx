import { useEffect, useRef, type ReactNode } from 'react';
import { BrandLogo } from './BrandLogo';
import { subscribeLoginLogoTransition } from './loginLogoTransition';

export function SidebarLoginLogo({ className, variant }: { className?: string; variant?: 'default' | 'collapsedSidebar' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current ? subscribeLoginLogoTransition(ref.current) : undefined, []);
  return <div ref={ref} className="h-full w-full"><BrandLogo className={className} variant={variant} /></div>;
}

/** A logo that the login transition can land on (the header logo on a phone, where the sidebar is a closed drawer). */
export function LoginLogoTarget({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current ? subscribeLoginLogoTransition(ref.current) : undefined, []);
  return <div ref={ref} className={className}>{children}</div>;
}
