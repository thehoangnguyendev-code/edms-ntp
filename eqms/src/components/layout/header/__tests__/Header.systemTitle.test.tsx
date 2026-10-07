import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const branding = vi.hoisted(() => ({ value: { showSidebarUserProfile: false, systemHeaderTitle: undefined as string | undefined } }));
const crumbs = vi.hoisted(() => ({ value: [{ label: 'Documents' }, { label: 'All documents', isActive: true }] }));

vi.mock('@/components/branding/BrandLogo', () => ({ useBranding: () => branding.value }));
vi.mock('@/contexts/BreadcrumbContext', () => ({ useBreadcrumb: () => ({ breadcrumbs: crumbs.value }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { fullName: 'Ada Lovelace', username: 'ada' }, logout: vi.fn() }) }));
vi.mock('../NotificationsDropdown', () => ({ NotificationsDropdown: () => null }));

import { Header } from '../Header';

const renderHeader = (props: Partial<React.ComponentProps<typeof Header>> = {}) =>
  render(
    <MemoryRouter>
      <Header onToggleSidebar={vi.fn()} isSidebarCollapsed={false} isMobileMenuOpen={false} headerTitle="Dashboard" showHeaderTitle={false} {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  branding.value = { showSidebarUserProfile: false, systemHeaderTitle: undefined };
});

describe('Header system title (Dashboard)', () => {
  it('shows the configured title in place of the breadcrumbs', () => {
    branding.value.systemHeaderTitle = 'Quality Hub';
    renderHeader({ pinSystemTitle: true });

    expect(screen.getByTestId('header-system-title')).toHaveTextContent('Quality Hub');
    expect(screen.queryByText('All documents')).toBeNull();
  });

  it('keeps the title after the page has scrolled, instead of giving way to the page title', () => {
    branding.value.systemHeaderTitle = 'Quality Hub';
    renderHeader({ pinSystemTitle: true, showHeaderTitle: true, headerTitle: 'Dashboard' });

    const title = screen.getByTestId('header-system-title');
    expect(title).toHaveTextContent('Quality Hub');
    expect(title.parentElement?.className).not.toContain('opacity-0');
    expect(title.parentElement?.className).toContain('md:flex'); // shown from tablet width up
    // the scrolled-page title is not used on desktop; it is still there for phones
    const pageTitle = screen.getByText('Dashboard').closest('div') as HTMLElement;
    expect(pageTitle.className).toContain('md:hidden');
  });

  it('falls back to the built-in text when the administrator left the title empty', () => {
    for (const empty of [undefined, '', '   ']) {
      branding.value.systemHeaderTitle = empty;
      const { unmount } = renderHeader({ pinSystemTitle: true });
      expect(screen.getByTestId('header-system-title')).toHaveTextContent('Electronic Quality Management Software');
      unmount();
    }
  });

  it('shows the administrator\'s text without surrounding spaces and never as markup', () => {
    branding.value.systemHeaderTitle = '  <b>Quality</b> Hub  ';
    renderHeader({ pinSystemTitle: true });

    const title = screen.getByTestId('header-system-title');
    expect(title.textContent).toBe('<b>Quality</b> Hub');
    expect(title.querySelector('b')).toBeNull();
    expect(title).toHaveAttribute('title', '<b>Quality</b> Hub'); // the full text is available when it is cut short
  });

  it('is not used on other pages: breadcrumbs and the scrolled-page title behave as before', () => {
    branding.value.systemHeaderTitle = 'Quality Hub';
    renderHeader({ showHeaderTitle: true, headerTitle: 'All documents' });

    expect(screen.queryByTestId('header-system-title')).toBeNull();
    // the last breadcrumb item (the first one is the Dashboard icon)
    expect(screen.getByText('All documents', { selector: 'span.text-slate-600' })).toBeInTheDocument();
    const pageTitle = screen.getByText('All documents', { selector: 'span.font-bold' }).closest('div') as HTMLElement;
    expect(pageTitle.className).not.toContain('md:hidden');
  });
});
