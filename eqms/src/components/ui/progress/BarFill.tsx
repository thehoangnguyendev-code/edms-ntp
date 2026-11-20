import { useRef } from 'react';
import { useBarFill } from '@/hooks/useBarFill';

/** The coloured part of a bar: `percent` of its track, filled with a short GSAP tween (see `useBarFill`). */
export function BarFill({ percent, className }: { percent: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useBarFill(ref, percent);
  return <div ref={ref} className={className} style={{ width: `${percent}%` }} />;
}
