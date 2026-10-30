import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SECURITY_CONFIG_STORAGE_KEY } from '@/config/security';

const auth = vi.hoisted(() => ({ user: { permissions: [] as string[] }, logout: () => Promise.resolve(), isAuthenticated: true }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/services/api/auth', () => ({ authApi: { touchSession: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('@/services/api/settings', () => ({ settingsApi: { getSecurityConfiguration: vi.fn().mockResolvedValue({ sessionTimeoutMinutes: 1, sessionTimeoutEnabled: false }) } }));
vi.mock('@/features/notifications/notificationRealtime', () => ({ subscribeNotificationRealtime: () => () => undefined }));
vi.mock('../SessionTimeoutModal', () => ({ SessionTimeoutModal: () => null }));
import { SessionTimeoutGuard } from '../SessionTimeoutGuard';

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

it('does not lock while disabled and follows later configuration changes', async () => {
  const locked = vi.fn();
  window.addEventListener('eqms:session-locked', locked);
  localStorage.setItem(SECURITY_CONFIG_STORAGE_KEY, JSON.stringify({ security: { sessionTimeoutMinutes: 1, sessionTimeoutEnabled: false } }));
  await act(async () => { render(<SessionTimeoutGuard />); });
  await act(async () => { vi.advanceTimersByTime(65000); });
  expect(locked).not.toHaveBeenCalled();
  localStorage.setItem(SECURITY_CONFIG_STORAGE_KEY, JSON.stringify({ security: { sessionTimeoutMinutes: 1, sessionTimeoutEnabled: true } }));
  await act(async () => { window.dispatchEvent(new Event('eqms:security-config-updated')); });
  await act(async () => { vi.advanceTimersByTime(5000); });
  expect(locked).toHaveBeenCalledTimes(1);
  window.removeEventListener('eqms:session-locked', locked);
});
