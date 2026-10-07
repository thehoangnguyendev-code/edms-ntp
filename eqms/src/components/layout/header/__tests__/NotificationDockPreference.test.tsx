import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('@/services/api/userUiPreferences', () => ({
  NOTIFICATION_DOCK_PREFERENCE: 'notification-dock',
  userUiPreferencesApi: api,
}));

import { NotificationDockProvider, useNotificationDock } from '../NotificationDockContext';

const Probe: React.FC = () => {
  const dock = useNotificationDock();
  return (
    <div>
      <span data-testid="docked">{String(dock.docked)}</span>
      <button onClick={dock.pin}>pin</button>
      <button onClick={dock.unpin}>unpin</button>
    </div>
  );
};

const mount = (userId: string | undefined = 'u1') =>
  render(
    <NotificationDockProvider userId={userId}>
      <Probe />
    </NotificationDockProvider>,
  );
const docked = () => screen.getByTestId('docked').textContent;
const cache = (userId = 'u1') => window.localStorage.getItem(`eqms:notification-dock:${userId}`);

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true, writable: true });
  api.get.mockReset();
  api.save.mockReset();
  api.get.mockResolvedValue({});
  api.save.mockResolvedValue(undefined);
});

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true, writable: true });
  vi.restoreAllMocks();
});

describe('The pinned notification list is a server-side preference of the user', () => {
  it('is restored on a browser that has never seen it, because the server has it', async () => {
    api.get.mockResolvedValue({ pinned: true });
    mount();

    expect(api.get).toHaveBeenCalledWith('notification-dock');
    await waitFor(() => expect(docked()).toBe('true'));
    expect(cache()).toBe('pinned'); // kept for a faster first paint next time
  });

  it('follows the server when it disagrees with this browser\'s copy', async () => {
    window.localStorage.setItem('eqms:notification-dock:u1', 'pinned');
    api.get.mockResolvedValue({ pinned: false });
    mount();

    expect(docked()).toBe('true'); // first paint uses the copy
    await waitFor(() => expect(docked()).toBe('false'));
    expect(cache()).toBeNull();
  });

  it('keeps what is shown when the user never chose on any browser', async () => {
    window.localStorage.setItem('eqms:notification-dock:u1', 'pinned');
    api.get.mockResolvedValue({});
    mount();

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(docked()).toBe('true');
  });

  it('saves each choice to the server for the signed-in user only', async () => {
    mount();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.click(screen.getByText('pin'));
    expect(docked()).toBe('true'); // at once, without waiting for the server
    expect(api.save).toHaveBeenLastCalledWith('notification-dock', { pinned: true });
    expect(cache()).toBe('pinned');

    fireEvent.click(screen.getByText('unpin'));
    expect(docked()).toBe('false');
    expect(api.save).toHaveBeenLastCalledWith('notification-dock', { pinned: false });
    expect(cache()).toBeNull();
    expect(api.save).toHaveBeenCalledTimes(2);
  });

  it('does not let a slow server answer undo what the user just chose', async () => {
    let answer: (value: { pinned: boolean }) => void = () => undefined;
    api.get.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    mount();

    fireEvent.click(screen.getByText('pin'));
    await act(async () => { answer({ pinned: false }); await Promise.resolve(); });

    expect(docked()).toBe('true');
  });

  it('keeps working from this browser\'s copy when the server cannot be reached, and says nothing more than a console warning when a save fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    window.localStorage.setItem('eqms:notification-dock:u1', 'pinned');
    api.get.mockRejectedValue(new Error('offline'));
    api.save.mockRejectedValue(new Error('offline'));
    mount();

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(docked()).toBe('true');

    fireEvent.click(screen.getByText('unpin'));
    expect(docked()).toBe('false'); // the choice stands even though it could not be saved
    await waitFor(() => expect(warn).toHaveBeenCalled());
  });

  it('asks again, for the new person, when someone else signs in', async () => {
    api.get.mockImplementation(async () => ({ pinned: true }));
    const { rerender } = mount('u1');
    await waitFor(() => expect(docked()).toBe('true'));

    api.get.mockResolvedValue({ pinned: false });
    rerender(<NotificationDockProvider userId="u2"><Probe /></NotificationDockProvider>);

    await waitFor(() => expect(docked()).toBe('false'));
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(cache('u1')).toBe('pinned'); // u1's copy is untouched
  });

  it('does nothing on the server before anybody is signed in', async () => {
    render(<NotificationDockProvider><Probe /></NotificationDockProvider>); // no userId: nobody is signed in
    fireEvent.click(screen.getByText('pin'));

    expect(api.get).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });
});
