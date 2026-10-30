import { useReducedMotion } from 'motion/react';
import { useBranding } from './BrandLogo';

export function AuthVideoBackground() {
  const { authBackground } = useBranding();
  const reduced = useReducedMotion();
  const id = authBackground?.videoId;
  if (reduced || authBackground?.mode !== 'video' || !id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return null;
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
  const color = /^#[0-9a-f]{6}$/i.test(authBackground.overlayColor ?? '') ? authBackground.overlayColor : '#000000';
  const opacity = Math.max(0, Math.min(100, authBackground.overlayOpacity ?? 20)) / 100;
  return <div data-auth-video aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    <video className="h-full w-full object-cover" src={`${base}/branding/auth-background-video/${id}`} autoPlay muted playsInline loop={authBackground.videoLoop ?? true} />
    <div className="absolute inset-0" style={{ backgroundColor: color, opacity }} />
  </div>;
}
