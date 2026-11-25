import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ get: vi.fn(), listener: undefined as undefined | ((event: { type: string }) => void) }));
vi.mock('@/services/api/branding', async (original) => ({
  ...await original<object>(), brandingApi: { get: state.get },
}));
vi.mock('@/features/notifications/notificationRealtime', () => ({
  subscribeNotificationRealtime: (listener: typeof state.listener) => { state.listener = listener; return () => { state.listener = undefined; }; },
}));
import { Loading } from '../Loading';

afterEach(() => { cleanup(); localStorage.removeItem('eqms:branding-cache'); });

it('refreshes a mounted loader after the server branding signal and retains the saved choice for returning users', async () => {
  localStorage.removeItem('eqms:branding-cache');
  state.get.mockResolvedValue({ systemDisplayName: 'EQMS', systemLogo: '', systemFavicon: '', loadingStyle: 'ring', loadingColor: '#112233' });
  const { container } = render(<Loading text="Shared loading" />);
  await waitFor(() => expect(container.querySelector('[data-loading-style="ring"]')).toHaveStyle({ color: '#112233' }));
  expect(state.get).toHaveBeenCalledOnce();
  state.get.mockResolvedValue({ systemDisplayName: 'EQMS', systemLogo: '', systemFavicon: '', loadingStyle: 'bars', loadingColor: '#abcdef' });
  state.listener?.({ type: 'branding-updated' });
  await waitFor(() => expect(container.querySelector('[data-loading-style="bars"]')).toHaveStyle({ color: '#abcdef' }));
  expect(state.get).toHaveBeenCalledTimes(2);
  expect(JSON.parse(localStorage.getItem('eqms:branding-cache')!)).toMatchObject({ loadingStyle: 'bars', loadingColor: '#abcdef' });
});
