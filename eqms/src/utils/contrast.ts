/** The contrast of a colour against another, as the Web Content Accessibility Guidelines measure it (1 = none, 21 = black on white). */
const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const parse = (hex: string): [number, number, number] | null => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : null;
};

const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** The contrast ratio of two six-digit hex colours; 1 when either is not a colour. */
export const contrastRatio = (a: string, b: string): number => {
  const first = parse(a);
  const second = parse(b);
  if (!first || !second) return 1;
  const [light, dark] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

const toHsl = ([r, g, b]: [number, number, number]): [number, number, number] => {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h / 6, s, l];
};

const fromHsl = ([h, s, l]: [number, number, number]): number[] => {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
  };
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
};

/**
 * The colour with the contrast against the background set to the ratio asked for (as near as a colour can come), keeping its hue and its saturation: only its
 * lightness moves. A lighter colour has less contrast against white, so the search is over the lightness between black and white.
 */
export const withContrast = (hex: string, background: string, ratio: number): string => {
  const rgb = parse(hex);
  if (!rgb) return hex;
  const [h, s] = toHsl(rgb);
  let low = 0;
  let high = 1;
  const lightBackground = contrastRatio('#000000', background) > contrastRatio('#FFFFFF', background);
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    const candidate = toHex(fromHsl([h, s, mid]));
    const value = contrastRatio(candidate, background);
    // against a light background the contrast falls as the colour gets lighter; against a dark one it rises
    if (lightBackground ? value > ratio : value < ratio) low = mid;
    else high = mid;
  }
  return toHex(fromHsl([h, s, (low + high) / 2]));
};
