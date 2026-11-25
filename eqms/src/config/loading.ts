/** Persisted machine values shared by Branding and every loading indicator. */
export const LOADING_STYLES = [
  'system', 'ring', 'spokes', 'classic', 'dots-ring', 'arc', 'dual-arc', 'fade-arc',
  'concentric-ring', 'orbit-ring', 'satellite-ring', 'clock-ring', 'quarter-ring',
  'dash-ring', 'pulse', 'ripple', 'pulse-dot', 'dots', 'bobbing-dots', 'bouncing-dots',
  'typing', 'wave', 'bars',
] as const;

export type LoadingStyle = (typeof LOADING_STYLES)[number];
export const DEFAULT_LOADING_STYLE: LoadingStyle = 'system';
export const DEFAULT_LOADING_COLOR = '#059669';

export function loadingStyle(value: unknown): LoadingStyle {
  return typeof value === 'string' && (LOADING_STYLES as readonly string[]).includes(value)
    ? value as LoadingStyle : DEFAULT_LOADING_STYLE;
}

export function loadingColor(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : DEFAULT_LOADING_COLOR;
}

export const LOADING_STYLE_LABELS: Record<LoadingStyle, string> = {
  system: 'System Default', ring: 'Ring', spokes: 'Spokes', classic: 'Classic',
  'dots-ring': 'Dots Ring', arc: 'Arc', 'dual-arc': 'Dual Arc', 'fade-arc': 'Fade Arc',
  'concentric-ring': 'Concentric Ring', 'orbit-ring': 'Orbit Ring', 'satellite-ring': 'Satellite Ring',
  'clock-ring': 'Clock Ring', 'quarter-ring': 'Quarter Ring', 'dash-ring': 'Dash Ring',
  pulse: 'Pulse', ripple: 'Ripple', 'pulse-dot': 'Pulse Dot', dots: 'Dots',
  'bobbing-dots': 'Bobbing Dots', 'bouncing-dots': 'Bouncing Dots', typing: 'Typing', wave: 'Wave', bars: 'Bars',
};
