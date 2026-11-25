import { DashLoading } from 'respinner';
import { useBranding } from '@/components/branding/BrandLogo';
import { loadingColor, loadingStyle, type LoadingStyle } from '@/config/loading';
import { cn } from '../utils';
import { Ring } from './loading-ui/ring';
import { Spokes } from './loading-ui/spokes';
import { Classic } from './loading-ui/classic';
import { DotsRing } from './loading-ui/dots-ring';
import { Arc } from './loading-ui/arc';
import { DualArc } from './loading-ui/dual-arc';
import { FadeArc } from './loading-ui/fade-arc';
import { ConcentricRing } from './loading-ui/concentric-ring';
import { OrbitRing } from './loading-ui/orbit-ring';
import { SatelliteRing } from './loading-ui/satellite-ring';
import { ClockRing } from './loading-ui/clock-ring';
import { QuarterRing } from './loading-ui/quarter-ring';
import { DashRing } from './loading-ui/dash-ring';
import { Pulse } from './loading-ui/pulse';
import { Ripple } from './loading-ui/ripple';
import { PulseDot } from './loading-ui/pulse-dot';
import { Dots } from './loading-ui/dots';
import { BobbingDots } from './loading-ui/bobbing-dots';
import { BouncingDots } from './loading-ui/bouncing-dots';
import { Typing } from './loading-ui/typing';
import { Wave } from './loading-ui/wave';
import { Bars } from './loading-ui/bars';
import './loading-ui/animations.css';
import './loading.css';

const VISUALS = {
  ring: Ring, spokes: Spokes, classic: Classic, 'dots-ring': DotsRing,
  arc: Arc, 'dual-arc': DualArc, 'fade-arc': FadeArc, 'concentric-ring': ConcentricRing,
  'orbit-ring': OrbitRing, 'satellite-ring': SatelliteRing, 'clock-ring': ClockRing,
  'quarter-ring': QuarterRing, 'dash-ring': DashRing, pulse: Pulse, ripple: Ripple,
  'pulse-dot': PulseDot, dots: Dots, 'bobbing-dots': BobbingDots,
  'bouncing-dots': BouncingDots, typing: Typing, wave: Wave, bars: Bars,
};

interface VisualProps {
  variant?: LoadingStyle;
  color?: string;
  size?: number;
  className?: string;
}

/** Pure preview: never writes to Branding or reads the unsaved draft globally. */
export function LoadingVisual({ variant = 'system', color = '#059669', size = 32, className }: VisualProps) {
  const selected = loadingStyle(variant);
  const Visual = selected === 'system' ? null : VISUALS[selected];
  return (
    <span aria-hidden="true" data-loading-style={selected} className={cn('eqms-loading-indicator inline-flex shrink-0 items-center justify-center', className)} style={{ color, width: size, height: size }}>
      <span className="eqms-loading-visual block h-full w-full">
        {/* Preserve each vendor's display mode and animation style. The two arcs
            need a box because their original div roots were adapted to spans. */}
        {Visual ? <Visual className={cn('h-full w-full', (selected === 'arc' || selected === 'dual-arc') && 'inline-block')} aria-hidden="true" role="presentation" /> : <DashLoading color={color} size={size} />}
      </span>
      <svg className="eqms-loading-static h-full w-full" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="42 15" /></svg>
    </span>
  );
}

/** Every user reads the same server-authoritative Branding, refreshed after commit. */
export function LoadingIndicator({ color, ...props }: Omit<VisualProps, 'variant'>) {
  const branding = useBranding();
  return <LoadingVisual {...props} variant={loadingStyle(branding.loadingStyle)} color={color ?? loadingColor(branding.loadingColor)} />;
}
