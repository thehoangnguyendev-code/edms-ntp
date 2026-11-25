import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shared = vi.hoisted(() => ({ branding: {} as Record<string, unknown> }));
vi.mock('@/components/branding/BrandLogo', () => ({ useBranding: () => shared.branding }));
import { Loading, InlineLoading, FullPageLoading, ButtonLoading, SectionLoading } from '../Loading';
import { LoadingVisual } from '../LoadingIndicator';
import { LOADING_STYLES } from '@/config/loading';
import { Button } from '@/components/ui/button/Button';

beforeEach(() => { shared.branding = {}; });
afterEach(cleanup);

describe('server-selected loading indicators', () => {
  it('preserves the existing default, label and inline size before any setting exists', () => {
    const { container } = render(<InlineLoading />);
    expect(container.querySelector('[data-loading-style="system"]')).toHaveStyle({ color: '#059669', width: '20px' });
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it.each(LOADING_STYLES)('renders %s within the same accessible sized frame', (variant) => {
    const { container } = render(<LoadingVisual variant={variant} color="#123456" size={24} />);
    expect(container.querySelector(`[data-loading-style="${variant}"]`)).toHaveStyle({ color: '#123456', width: '24px', height: '24px' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument(); // the visual is decorative
    expect(container.querySelector('.eqms-loading-static')).toBeInTheDocument();
  });

  it('updates existing indicators when shared branding changes and keeps explicit contrast overrides', () => {
    shared.branding = { loadingStyle: 'ring', loadingColor: '#112233' };
    const { container, rerender } = render(<><Loading text="Working" /><ButtonLoading light /></>);
    expect(container.querySelectorAll('[data-loading-style="ring"]')).toHaveLength(2);
    expect(container.querySelector('[data-loading-style="ring"]')).toHaveStyle({ color: '#112233' });
    expect(container.querySelectorAll('[data-loading-style="ring"]')[1]).toHaveStyle({ color: '#ffffff' });
    shared.branding = { loadingStyle: 'bars', loadingColor: '#abcdef' };
    rerender(<><Loading text="Working" /><ButtonLoading light /></>);
    expect(container.querySelectorAll('[data-loading-style="bars"]')).toHaveLength(2);
    expect(container.querySelector('[data-loading-style="bars"]')).toHaveStyle({ color: '#abcdef' });
  });

  it('uses safe defaults for unknown or malformed values from an old cache', () => {
    shared.branding = { loadingStyle: 'untrusted', loadingColor: 'url(evil)' };
    const { container } = render(<Loading />);
    expect(container.querySelector('[data-loading-style="system"]')).toHaveStyle({ color: '#059669' });
  });

  it('keeps the full-page portal, section height and explicit caller colour', () => {
    render(<><FullPageLoading text="Saving" /><SectionLoading text="Fetching" minHeight="120px" /><Loading color="#ffffff" text="Explicit" /></>);
    expect(screen.getByRole('status', { name: 'Saving' }).parentElement).toHaveClass('fixed', 'inset-0');
    expect(screen.getByRole('status', { name: 'Fetching' }).parentElement).toHaveStyle({ minHeight: '120px' });
    expect(screen.getByRole('status', { name: 'Explicit' }).querySelector('[data-loading-style]')).toHaveStyle({ color: '#ffffff' });
  });

  it('changes only the button visual and keeps pending actions disabled', () => {
    shared.branding = { loadingStyle: 'dots', loadingColor: '#123456' };
    const onClick = vi.fn();
    const { container, rerender } = render(<Button variant="outline" loading loadingText="Saving" onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toBeDisabled();
    expect(container.querySelector('[data-loading-style="dots"]')).toHaveStyle({ color: '#123456' });
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    rerender(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('keeps white indicators readable on filled buttons without changing their selected animation', () => {
    shared.branding = { loadingStyle: 'ring', loadingColor: '#059669' };
    const { container } = render(<><Button loading>Save</Button><Button variant="destructive" loading>Remove</Button></>);
    const indicators = container.querySelectorAll('[data-loading-style="ring"]');
    expect(indicators).toHaveLength(2);
    indicators.forEach((indicator) => expect(indicator).toHaveStyle({ color: '#ffffff' }));
  });
});
