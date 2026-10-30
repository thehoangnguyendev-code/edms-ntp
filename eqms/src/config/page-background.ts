export type PageBackgroundMode = 'default' | 'solid' | 'linear' | 'radial' | 'conic' | 'image' | 'video';
export type PageBackground = { mode: PageBackgroundMode; colors: string[]; angle: number; stops?: number[]; centerX?: number; centerY?: number; image?: string; imageFit?: 'cover' | 'contain' | 'repeat'; overlayColor?: string; overlayOpacity?: number; videoId?: string; videoLoop?: boolean };

export const DEFAULT_PAGE_BACKGROUND: PageBackground = { mode: 'default', colors: ['#F8FAFC', '#E0F2FE'], angle: 135 };

/** Converts only validated machine values into CSS; never accepts arbitrary CSS from the API. */
export function pageBackgroundCss(value?: PageBackground | null): string | undefined {
  if (!value || !['solid', 'linear', 'radial', 'conic', 'image', 'video'].includes(value.mode) || !Array.isArray(value.colors)
    || value.colors.length < 2 || value.colors.length > 5 || value.colors.some((color) => !/^#[0-9a-f]{6}$/i.test(color))
    || !Number.isInteger(value.angle) || value.angle < 0 || value.angle > 360) return undefined;
  if (value.mode === 'video') return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.videoId ?? '') ? '#fefcff' : undefined;
  if (value.mode === 'image') {
    if (!value.image || value.image.length > 1400000 || !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(value.image) || !/^#[0-9a-f]{6}$/i.test(value.overlayColor ?? '#000000') || !Number.isInteger(value.overlayOpacity ?? 0) || (value.overlayOpacity ?? 0) < 0 || (value.overlayOpacity ?? 0) > 100 || !['cover', 'contain', 'repeat'].includes(value.imageFit ?? 'cover')) return undefined;
    const opacity = (value.overlayOpacity ?? 0) / 100;
    const color = value.overlayColor ?? '#000000';
    const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)).join(', ');
    const layer = `linear-gradient(rgba(${rgb}, ${opacity}), rgba(${rgb}, ${opacity}))`;
    const fit = value.imageFit ?? 'cover';
    return `${layer}, url("${value.image}") center / ${fit === 'repeat' ? 'auto' : fit} ${fit === 'repeat' ? 'repeat' : 'no-repeat'} #fff`;
  }
  if (value.mode === 'solid') return value.colors[0];
  if (value.stops && (value.stops.length !== value.colors.length || value.stops.some((n, i) => !Number.isInteger(n) || n < 0 || n > 100 || (i > 0 && n < value.stops![i - 1])))) return undefined;
  if ([value.centerX, value.centerY].some((n) => n !== undefined && (!Number.isInteger(n) || n < 0 || n > 100))) return undefined;
  const colors = value.colors.map((color, index) => value.stops ? `${color} ${value.stops[index]}%` : color).join(', ');
  if (value.mode === 'linear') return `linear-gradient(${value.angle}deg, ${colors})`;
  if (value.mode === 'radial') return value.centerX === undefined && value.centerY === undefined ? `radial-gradient(circle, ${colors})` : `radial-gradient(circle at ${value.centerX ?? 50}% ${value.centerY ?? 50}%, ${colors})`;
  return `conic-gradient(from ${value.angle}deg, ${colors})`;
}
