import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification as ApiNotification } from '@/services/api/notifications';

const api = vi.hoisted(() => ({ getSummary: vi.fn(), getNotifications: vi.fn(), markAllAsRead: vi.fn() }));
vi.mock('@/services/api/notifications', () => ({ notificationApi: api }));
vi.mock('@/features/notifications/notificationRealtime', () => ({ useNotificationRealtime: () => undefined }));
vi.mock('@/services/api/userUiPreferences', () => ({
  NOTIFICATION_DOCK_PREFERENCE: 'notification-dock',
  userUiPreferencesApi: { get: vi.fn().mockResolvedValue({}), save: vi.fn().mockResolvedValue(undefined) },
}));

import { emitNotificationsChanged } from '@/features/notifications/events';
import { NotificationDock, DOCK_PAGE_SIZE } from '../NotificationDock';
import { NotificationDockProvider } from '../NotificationDockContext';
import { NotificationsDropdown } from '../NotificationsDropdown';

const item = (n: number): ApiNotification => ({
  id: `n${n}`, type: 'system', scope: 'all', title: `Notice ${n}`, description: '', module: 'System', priority: 'normal',
  status: n % 2 ? 'unread' : 'read', createdAt: '2026-10-07T08:00:00Z', actionUrl: null,
});
const page = (count: number, total = count) => ({ data: Array.from({ length: count }, (_, i) => item(i + 1)), pagination: { page: 1, limit: count, total, totalPages: 1 } });
const summary = (all: number) => ({ all, unread: 1, personal: all - 1, system: 1 });

/** The bell and dropdown as the top bar mounts them, plus the dock, under the provider the layout supplies. */
const Layout: React.FC<{ userId?: string }> = ({ userId = 'u1' }) => {
  const [open, setOpen] = useState(false);
  return (
    <MemoryRouter>
      <NotificationDockProvider userId={userId}>
        <NotificationsDropdown isOpen={open} onClose={() => setOpen(false)} onToggle={() => setOpen((value) => !value)} />
        <NotificationDock />
      </NotificationDockProvider>
    </MemoryRouter>
  );
};

const setWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
  window.dispatchEvent(new Event('resize'));
};

const bell = () => screen.getByRole('button', { name: /^Notifications/ });
const dock = () => screen.queryByTestId('notification-dock');

beforeEach(() => {
  window.localStorage.clear();
  setWidth(1280);
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getSummary.mockResolvedValue(summary(60));
  api.getNotifications.mockImplementation(async (params: { limit?: number }) => page(Math.min(params.limit ?? 8, 60), 60));
  api.markAllAsRead.mockResolvedValue(undefined);
});

afterEach(() => setWidth(1024));

describe('Pinning the notification list to the side', () => {
  it('offers Pin in the dropdown, between the title and the settings icon', async () => {
    render(<Layout />);
    fireEvent.click(bell());

    const pin = await screen.findByRole('button', { name: 'Pin notifications to the side' });
    expect(pin).toHaveAttribute('aria-pressed', 'false');
    expect(pin.nextElementSibling).toBe(screen.getByRole('button', { name: 'Notification settings' }));
    expect(dock()).toBeNull();
  });

  it('moves the list to the side at once: the dropdown closes and the dock shows more notifications', async () => {
    render(<Layout />);
    fireEvent.click(bell());
    await screen.findByText('Notice 1');
    expect(api.getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 8 }));

    fireEvent.click(screen.getByRole('button', { name: 'Pin notifications to the side' }));

    const side = await screen.findByTestId('notification-dock');
    expect(screen.queryByRole('button', { name: 'Pin notifications to the side' })).toBeNull(); // the dropdown is gone
    expect(await within(side).findByText('Notice 25')).toBeInTheDocument(); // more than the dropdown's 8
    expect(api.getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ limit: DOCK_PAGE_SIZE }));
    expect(within(side).getByRole('button', { name: 'Unpin notifications' })).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('eqms:notification-dock:u1')).toBe('pinned');
  });

  it('asks for the next page on "Show more" and stops offering it once everything is shown', async () => {
    api.getSummary.mockResolvedValue(summary(30));
    api.getNotifications.mockImplementation(async (params: { limit?: number }) => page(Math.min(params.limit ?? 8, 30), 30));
    window.localStorage.setItem('eqms:notification-dock:u1', 'pinned');
    render(<Layout />);

    const side = await screen.findByTestId('notification-dock');
    const more = await within(side).findByRole('button', { name: `Show more (${DOCK_PAGE_SIZE} of 30)` });
    fireEvent.click(more);

    await waitFor(() => expect(api.getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ limit: DOCK_PAGE_SIZE * 2 })));
    expect(await within(side).findByText('Notice 30')).toBeInTheDocument();
    expect(within(side).queryByRole('button', { name: /Show more/ })).toBeNull();
  });

  it('puts the dropdown back when the list is unpinned, and forgets the preference', async () => {
    window.localStorage.setItem('eqms:notification-dock:u1', 'pinned');
    render(<Layout />);
    const side = await screen.findByTestId('notification-dock');

    fireEvent.click(within(side).getByRole('button', { name: 'Unpin notifications' }));

    await waitFor(() => expect(dock()).toBeNull());
    expect(window.localStorage.getItem('eqms:notification-dock:u1')).toBeNull();
    fireEvent.click(bell());
    expect(await screen.findByRole('button', { name: 'Pin notifications to the side' })).toBeInTheDocument();
  });

  it('does not open a second list from the bell while docked; it moves focus to the dock instead', async () => {
    window.localStorage.setItem('eqms:notification-dock:u1', 'pinned');
    render(<Layout />);
    const side = await screen.findByTestId('notification-dock');
    expect(bell()).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(bell());

    expect(screen.queryByRole('button', { name: 'Pin notifications to the side' })).toBeNull();
    await waitFor(() => expect(within(side).getByRole('heading', { name: 'Notifications' })).toHaveFocus());
  });

  it('is remembered per user on this browser', async () => {
    window.localStorage.setItem('eqms:notification-dock:u1', 'pinned');
    const { unmount } = render(<Layout userId="u1" />);
    expect(await screen.findByTestId('notification-dock')).toBeInTheDocument();
    unmount();

    render(<Layout userId="u2" />);
    await waitFor(() => expect(api.getSummary).toHaveBeenCalled()); // the bell has loaded
    expect(dock()).toBeNull();
  });

  it('cannot be pinned in a window too narrow to leave the page a usable width, and a stored pin is not applied there', async () => {
    window.localStorage.setItem('eqms:notification-dock:u1', 'pinned');
    setWidth(900);
    render(<Layout />);
    await waitFor(() => expect(api.getSummary).toHaveBeenCalled());
    expect(dock()).toBeNull();

    fireEvent.click(bell());
    const pin = await screen.findByRole('button', { name: 'Pinning needs a wider window' });
    expect(pin).toBeDisabled();

    act(() => setWidth(1280)); // widening the window brings the dock back without a reload
    expect(await screen.findByTestId('notification-dock')).toBeInTheDocument();
  });

  it('refreshes itself when notifications change, and marks everything read after a confirmation', async () => {
    window.localStorage.setItem('eqms:notification-dock:u1', 'pinned');
    render(<Layout />);
    const side = await screen.findByTestId('notification-dock');
    await within(side).findByText('Notice 1');
    const before = api.getNotifications.mock.calls.length;

    act(() => emitNotificationsChanged());
    await waitFor(() => expect(api.getNotifications.mock.calls.length).toBeGreaterThan(before));

    fireEvent.click(within(side).getByRole('button', { name: 'Mark All as Read' }));
    expect(api.markAllAsRead).not.toHaveBeenCalled(); // asks first
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, Mark All' }));
    await waitFor(() => expect(api.markAllAsRead).toHaveBeenCalledTimes(1));
  });
});
