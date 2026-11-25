import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadingVisual } from '../LoadingIndicator';

vi.mock('@/components/branding/BrandLogo', () => ({ useBranding: () => ({}) }));
afterEach(cleanup);

describe('Loading UI animation integration', () => {
  it.each(['concentric-ring', 'orbit-ring', 'satellite-ring', 'clock-ring', 'quarter-ring', 'pulse-dot'] as const)(
    'preserves the vendor root animation for %s', (variant) => {
      const { container } = render(<LoadingVisual variant={variant} />);
      const visual = container.querySelector('.eqms-loading-visual > span') as HTMLElement;
      expect(visual.style.animation).toContain('loading-ui-');
      expect(visual.style.animation).toContain('infinite');
    },
  );

  it.each(['dots', 'bars', 'wave', 'bobbing-dots', 'bouncing-dots', 'typing', 'dots-ring'] as const)(
    'keeps the flex layout needed to size the shapes in %s', (variant) => {
      const { container } = render(<LoadingVisual variant={variant} />);
      const visual = container.querySelector('.eqms-loading-visual > span');
      expect(visual).toHaveClass('inline-flex', 'h-full', 'w-full');
      expect(visual).not.toHaveClass('block');
    },
  );

  it.each(['arc', 'dual-arc'] as const)('gives the inline %s root a sized box', (variant) => {
    const { container } = render(<LoadingVisual variant={variant} />);
    expect(container.querySelector('.eqms-loading-visual > span')).toHaveClass('inline-block', 'h-full', 'w-full');
  });
});
