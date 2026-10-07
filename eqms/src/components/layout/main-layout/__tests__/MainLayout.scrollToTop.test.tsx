import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const scrollTop = vi.hoisted(() => ({ props: undefined as Record<string, unknown> | undefined }));

vi.mock('@/components/layout/sidebar/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('@/components/layout/header/Header', () => ({ Header: () => null }));
vi.mock('@/components/layout/footer/Footer', () => ({ Footer: () => null }));
vi.mock('@/components/layout/NetworkStatusMonitor', () => ({ NetworkStatusMonitor: () => null }));
vi.mock('@/components/layout/header/NotificationDock', () => ({ NotificationDock: () => null }));
vi.mock('@/features/auth/components', () => ({ SessionTimeoutModal: () => null }));
vi.mock('@/components/ui/scroll-to-top/ScrollToTop', () => ({
  ScrollToTop: (props: Record<string, unknown>) => {
    scrollTop.props = props;
    return <button data-testid="scroll-top">Top</button>;
  },
}));
vi.mock('../useNavigation', () => ({ useNavigation: () => ({ activeId: '', handleNavigate: vi.fn() }) }));
vi.mock('../useResponsiveSidebar', () => ({
  useResponsiveSidebar: () => ({ isSidebarCollapsed: false, isMobileMenuOpen: false, toggleSidebar: vi.fn(), closeMobileMenu: vi.fn() }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', username: 'ada' }, logout: vi.fn(), isAuthenticated: false }) }));
vi.mock('@/services/api/auth', () => ({ authApi: {} }));
vi.mock('@/services/api/settings', () => ({ settingsApi: {} }));
vi.mock('@/services/api/userUiPreferences', () => ({
  NOTIFICATION_DOCK_PREFERENCE: 'notification-dock',
  userUiPreferencesApi: { get: vi.fn().mockResolvedValue({}), save: vi.fn().mockResolvedValue(undefined) },
}));

import { MainLayout } from '../MainLayout';

/** jsdom has no layout, so the page column's right edge and the resize observer are stood in for. */
let columnRight = 0;
const observers: Array<() => void> = [];
class FakeResizeObserver {
  constructor(callback: () => void) { observers.push(callback); }
  observe() { /* the test fires the callback itself */ }
  disconnect() { /* nothing to release */ }
}

const setWindowWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
};
const remeasure = () => act(() => { observers.forEach((callback) => callback()); });
const holder = () => screen.getByTestId('scroll-top').parentElement as HTMLElement;

beforeEach(() => {
  observers.length = 0;
  scrollTop.props = undefined;
  setWindowWidth(1280);
  columnRight = 1280;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('IntersectionObserver', class { observe() { /* unused here */ } disconnect() { /* unused here */ } });
  HTMLElement.prototype.scrollTo = vi.fn() as unknown as typeof HTMLElement.prototype.scrollTo; // jsdom has no scrollTo
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const right = this.dataset.testid === 'page-column' ? columnRight : 0;
    return { x: 0, y: 0, top: 0, left: 0, bottom: 0, width: 0, height: 0, right, toJSON: () => ({}) } as DOMRect;
  });
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes><Route element={<MainLayout />}><Route path="dashboard" element={<h1>Page</h1>} /></Route></Routes>
    </MemoryRouter>,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setWindowWidth(1024);
});

describe('MainLayout places the scroll-to-top button by itself', () => {
  it('keeps the button at the window edge when nothing sits beside the page', () => {
    expect(holder().style.right).toBe('0px');
  });

  it('moves it left by whatever panel narrows the page column, with no knowledge of that panel', () => {
    columnRight = 1280 - 360; // a 360 px panel appeared beside the page
    remeasure();
    expect(holder().style.right).toBe('360px');

    columnRight = 1280 - 120; // it slid partly away
    remeasure();
    expect(holder().style.right).toBe('120px');

    columnRight = 1280; // and is gone
    remeasure();
    expect(holder().style.right).toBe('0px');
  });

  it('follows a change of window width', () => {
    columnRight = 1000;
    setWindowWidth(1400);
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(holder().style.right).toBe('400px');
  });

  it('is a click-through, window-sized box that the button is positioned inside; the button gets no extra props', () => {
    expect(holder().className).toContain('fixed');
    expect(holder().className).toContain('pointer-events-none');
    expect(holder().style.transform).not.toBe(''); // makes the holder the box the button's own fixed position refers to
    expect(Object.keys(scrollTop.props ?? {}).sort()).toEqual(['isMobileMenuOpen', 'scrollContainerRef']);
  });
});
