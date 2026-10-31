import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ScrollToTop } from '../ScrollToTop';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each([false, true])('uses browser navigation and respects Reduce Motion = %s', reduced => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced })));
  const container = document.createElement('div');
  container.scrollTop = 800;
  container.scrollTo = vi.fn();
  const frame = vi.fn();
  vi.stubGlobal('requestAnimationFrame', frame);
  render(<ScrollToTop scrollContainerRef={{ current: container }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Scroll to top' }));
  expect(container.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: reduced ? 'instant' : 'smooth' });
  // No custom loop continues scrolling after the user wheels or touches the page.
  expect(frame).not.toHaveBeenCalled();
});
