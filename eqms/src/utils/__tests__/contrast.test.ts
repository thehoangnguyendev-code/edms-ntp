import { describe, expect, it } from 'vitest';
import { contrastRatio, withContrast } from '../contrast';

describe('contrast', () => {
  it('measures black on white as 21 and a colour on itself as 1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#3B82F6', '#3B82F6')).toBeCloseTo(1, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
  });

  it('says a very light colour is faint on white and the default blue is not', () => {
    expect(contrastRatio('#FDE68A', '#FFFFFF')).toBeLessThan(3);
    expect(contrastRatio('#3B82F6', '#FFFFFF')).toBeGreaterThan(3);
  });

  it('sets the contrast of a colour to the ratio asked for, keeping its hue', () => {
    for (const ratio of [1.5, 3, 4.5, 8]) {
      const result = withContrast('#D946EF', '#FFFFFF', ratio);
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
      expect(contrastRatio(result, '#FFFFFF')).toBeGreaterThan(ratio - 0.15);
      expect(contrastRatio(result, '#FFFFFF')).toBeLessThan(ratio + 0.15);
    }
    // a grey stays a grey, and a stronger ratio is a darker colour
    const grey = withContrast('#888888', '#FFFFFF', 5);
    expect(grey.slice(1, 3)).toBe(grey.slice(3, 5));
    expect(contrastRatio(withContrast('#3B82F6', '#FFFFFF', 7), '#FFFFFF')).toBeGreaterThan(contrastRatio(withContrast('#3B82F6', '#FFFFFF', 2), '#FFFFFF'));
  });

  it('does not break on something that is not a colour', () => {
    expect(contrastRatio('red', '#FFFFFF')).toBe(1);
    expect(withContrast('red', '#FFFFFF', 3)).toBe('red');
  });
});
