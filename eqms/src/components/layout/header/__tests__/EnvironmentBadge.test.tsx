import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EnvironmentBadge, resetEnvironmentBadgeCache } from '../EnvironmentBadge';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/api/systemEnvironment', () => ({ systemEnvironmentApi: api }));

beforeEach(() => {
  resetEnvironmentBadgeCache();
  api.get.mockReset();
});
afterEach(cleanup);

it('labels the DEV environment', async () => {
  api.get.mockResolvedValue('DEV');
  render(<EnvironmentBadge />);
  expect(await screen.findByText('DEV')).toBeTruthy();
});

it('labels the TEST environment and says it is not a GMP record', async () => {
  api.get.mockResolvedValue('TEST');
  render(<EnvironmentBadge />);
  expect(await screen.findByText('TEST')).toBeTruthy();
  expect(screen.getByTestId('environment-badge').getAttribute('title')).toContain('not a GMP record');
});

it('shows nothing in PROD', async () => {
  api.get.mockResolvedValue('PROD');
  render(<EnvironmentBadge />);
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(screen.queryByTestId('environment-badge')).toBeNull();
});

it('shows nothing, rather than guessing, when the environment cannot be read', async () => {
  api.get.mockRejectedValue(new Error('network'));
  render(<EnvironmentBadge />);
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(screen.queryByTestId('environment-badge')).toBeNull();
});

it('asks the server only once per page load', async () => {
  api.get.mockResolvedValue('DEV');
  const first = render(<EnvironmentBadge />);
  await screen.findByText('DEV');
  first.unmount();
  render(<EnvironmentBadge />);
  expect(await screen.findByText('DEV')).toBeTruthy();
  expect(api.get).toHaveBeenCalledTimes(1);
});
