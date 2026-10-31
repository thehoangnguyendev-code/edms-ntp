import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Footer } from '../Footer';

const branding = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/components/branding/BrandLogo', () => ({ useBranding: () => branding.value }));

const year = String(new Date().getFullYear());

describe('Footer', () => {
  it('shows the built-in copyright on the left and nothing on the right when nothing was set', () => {
    branding.value = {};
    render(<Footer />);
    expect(screen.getByText(`© ${year} Ngoc Thien Pharma. All rights reserved.`)).toBeInTheDocument();
    expect(screen.getByRole('contentinfo').className).toContain('md:block');
    expect(screen.getByRole('contentinfo').className).toContain('hidden');
  });

  it('shows the left and the right text, the right one always aligned to the right', () => {
    branding.value = { systemFooterLeft: 'Left {year}', systemFooterRight: 'Hotline 123' };
    render(<Footer />);
    expect(screen.getByText(`Left ${year}`).className).toContain('md:text-left');
    const right = screen.getByText('Hotline 123');
    expect(right.className).toContain('md:text-right');
    expect(right.className).toContain('md:ml-auto');
  });

  it('follows the two switches: mobile and desktop/tablet', () => {
    branding.value = { systemFooterLeft: 'Left', footerShowOnDesktop: false, footerShowOnMobile: true };
    const { unmount } = render(<Footer />);
    const className = screen.getByRole('contentinfo').className;
    expect(className).toContain('block');
    expect(className).toContain('md:hidden');
    unmount();

    branding.value = { systemFooterLeft: 'Left', footerShowOnDesktop: false, footerShowOnMobile: false };
    render(<Footer />);
    expect(screen.queryByRole('contentinfo')).toBeNull();
  });

  it('draws nothing on a side that the administrator emptied', () => {
    branding.value = { systemFooterLeft: '', systemFooterRight: 'Only right' };
    render(<Footer />);
    expect(screen.getByText('Only right')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo').querySelectorAll('p')).toHaveLength(1);
  });
});
