import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Every time the layout renders its header, the progress it passed is recorded. */
const headerRenders = vi.hoisted(() => ({ progress: [] as number[] }));

vi.mock('@/components/layout/sidebar/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('@/components/layout/header/Header', () => ({
  Header: (props: { scrollProgress?: number }) => {
    headerRenders.progress.push(props.scrollProgress ?? -1);
    return null;
  },
}));
vi.mock('@/components/layout/footer/Footer', () => ({ Footer: () => null }));
vi.mock('@/components/layout/NetworkStatusMonitor', () => ({ NetworkStatusMonitor: () => null }));
vi.mock('@/components/layout/header/NotificationDock', () => ({ NotificationDock: () => null }));
vi.mock('@/features/auth/components', () => ({ SessionTimeoutModal: () => null }));
vi.mock('@/components/ui/scroll-to-top/ScrollToTop', () => ({ ScrollToTop: () => null }));
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

/** The browser calls animation frames at most once per screen refresh; the test calls them when it says so. */
let frames: FrameRequestCallback[] = [];
const flushFrames = () => act(() => {
  const due = frames;
  frames = [];
  due.forEach((callback) => callback(0));
});

class QuietObserver {
  observe() { /* not needed */ }
  disconnect() { /* not needed */ }
  unobserve() { /* not needed */ }
}

let container: HTMLElement;
const scrollTo = (top: number) => {
  Object.defineProperty(container, 'scrollTop', { value: top, configurable: true, writable: true });
  container.dispatchEvent(new Event('scroll'));
};

beforeEach(() => {
  headerRenders.progress.length = 0;
  frames = [];
  vi.stubGlobal('ResizeObserver', QuietObserver);
  vi.stubGlobal('IntersectionObserver', QuietObserver);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  HTMLElement.prototype.scrollTo = vi.fn() as unknown as typeof HTMLElement.prototype.scrollTo;
  render(
    <MemoryRouter initialEntries={['/documents']}>
      <Routes><Route element={<MainLayout />}><Route path="documents" element={<h1>Page</h1>} /></Route></Routes>
    </MemoryRouter>,
  );
  container = document.getElementById('main-scroll-container') as HTMLElement;
  Object.defineProperty(container, 'scrollHeight', { value: 2000, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true }); // 1500 px can be scrolled
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MainLayout while the page scrolls', () => {
  it('renders the layout once for a burst of scroll events inside the same percent, not once per event', () => {
    const before = headerRenders.progress.length;

    for (let top = 151; top <= 157; top += 0.14) scrollTo(top); // about 43 events, all between 10.07% and 10.47%
    expect(frames).toHaveLength(1); // one measurement is scheduled for the next frame, however many events came
    flushFrames();

    expect(headerRenders.progress.length - before).toBe(1);
    expect(headerRenders.progress.at(-1)).toBe(10);
  });

  it('does not render again when the next frame lands on the same percent', () => {
    scrollTo(151);
    flushFrames();
    const settled = headerRenders.progress.length;

    scrollTo(155);
    flushFrames();

    expect(headerRenders.progress.length).toBe(settled);
  });

  it('follows the scroll position in whole percents, from the top to the bottom', () => {
    scrollTo(750);
    flushFrames();
    expect(headerRenders.progress.at(-1)).toBe(50);

    scrollTo(1500);
    flushFrames();
    expect(headerRenders.progress.at(-1)).toBe(100);
  });
});
