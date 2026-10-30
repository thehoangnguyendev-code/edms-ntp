import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { PageBackground } from '@/config/page-background';

const branding = vi.hoisted(() => ({ mainBackground: null as PageBackground | null, authBackground: null as PageBackground | null }));
vi.mock('../BrandLogo', () => ({ useBranding: () => branding }));
import { PageBackgroundStyles } from '../PageBackgroundStyles';

it('applies independent saved backgrounds and restores defaults on cleanup', () => {
  branding.mainBackground = { mode: 'linear', colors: ['#FFFFFF', '#123456'], angle: 45 };
  branding.authBackground = { mode: 'solid', colors: ['#E0F2FE', '#FFFFFF'], angle: 0 };
  const view = render(<PageBackgroundStyles />);
  expect(document.documentElement.style.getPropertyValue('--main-page-background')).toBe('linear-gradient(45deg, #FFFFFF, #123456)');
  expect(document.documentElement.style.getPropertyValue('--auth-page-background')).toBe('#E0F2FE');
  branding.mainBackground = null;
  view.rerender(<PageBackgroundStyles />);
  expect(document.documentElement.dataset.mainBackground).toBeUndefined();
  expect(document.documentElement.dataset.authBackground).toBe('custom');
  view.unmount();
  expect(document.documentElement.dataset.authBackground).toBeUndefined();
});
