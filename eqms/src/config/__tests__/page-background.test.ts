import { describe, expect, it } from 'vitest';
import { pageBackgroundCss } from '../page-background';

describe('page background CSS', () => {
  it('generates each supported background from validated values', () => {
    const value = { colors: ['#FFFFFF', '#123456', '#ABCDEF'], angle: 45 };
    expect(pageBackgroundCss({ ...value, mode: 'default' })).toBeUndefined();
    expect(pageBackgroundCss({ ...value, mode: 'solid' })).toBe('#FFFFFF');
    expect(pageBackgroundCss({ ...value, mode: 'linear' })).toBe('linear-gradient(45deg, #FFFFFF, #123456, #ABCDEF)');
    expect(pageBackgroundCss({ ...value, mode: 'radial' })).toBe('radial-gradient(circle, #FFFFFF, #123456, #ABCDEF)');
    expect(pageBackgroundCss({ ...value, mode: 'conic' })).toBe('conic-gradient(from 45deg, #FFFFFF, #123456, #ABCDEF)');
  });
  it('ignores malformed values rather than injecting CSS', () => {
    expect(pageBackgroundCss({ mode: 'linear', colors: ['#FFFFFF', 'red;display:none'], angle: 0 })).toBeUndefined();
    expect(pageBackgroundCss({ mode: 'linear', colors: ['#FFFFFF', '#000000'], angle: 361 })).toBeUndefined();
  });
  it('renders stop positions, radial center and a validated image with overlay', () => {
    const base = { colors: ['#FFFFFF', '#123456'], angle: 45 };
    expect(pageBackgroundCss({ ...base, mode: 'radial', stops: [10, 80], centerX: 25, centerY: 60 })).toBe('radial-gradient(circle at 25% 60%, #FFFFFF 10%, #123456 80%)');
    expect(pageBackgroundCss({ ...base, mode: 'image', image: 'data:image/png;base64,aGVsbG8=', imageFit: 'cover', overlayColor: '#000000', overlayOpacity: 50 })).toContain('rgba(0, 0, 0, 0.5)');
    expect(pageBackgroundCss({ ...base, mode: 'image', image: 'https://example.com/image.png' })).toBeUndefined();
    expect(pageBackgroundCss({ ...base, mode: 'linear', stops: [90, 10] })).toBeUndefined();
  });
});
