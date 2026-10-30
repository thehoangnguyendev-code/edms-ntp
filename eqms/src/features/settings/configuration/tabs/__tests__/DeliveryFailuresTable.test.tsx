import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/toast/Toast';

const api = vi.hoisted(() => ({ getDeliveryFailures: vi.fn(), getDeliveryFailureEventDomains: vi.fn(), retryDeliveryFailure: vi.fn() }));
vi.mock('@/services/api/notifications', async (importOriginal) => ({ ...(await importOriginal<object>()), notificationApi: api }));

import { DeliveryFailuresTable } from '../DeliveryFailuresTable';

const row = (over: Record<string, unknown>) => ({ id: 'f1', recipient: 'qa@company.com', notificationType: 'CONTROLLED_COPY_ISSUED', eventDomain: 'CONTROLLED_COPY', channel: 'EMAIL', errorMessage: 'Mailbox full', attempts: 1, createdAt: '2026-10-27T03:00:00Z', lastAttemptAt: '2026-10-27T03:00:00Z', status: 'FAILED', ...over });
const page = (data: unknown[]) => ({ data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 } });

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getDeliveryFailureEventDomains.mockResolvedValue(['CONTROLLED_COPY']);
  api.getDeliveryFailures.mockResolvedValue(page([row({}), row({ id: 'f2', recipient: 'done@company.com', status: 'RESOLVED', attempts: 2 }), row({ id: 'f3', recipient: 'limit@company.com', attempts: 5 })]));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const renderTable = () => render(<ToastProvider><MemoryRouter><DeliveryFailuresTable /></MemoryRouter></ToastProvider>);

describe('DeliveryFailuresTable', () => {
  it('asks the server for a page sorted by the last attempt, newest first', async () => {
    renderTable();
    expect((await screen.findAllByText('qa@company.com')).length).toBeGreaterThan(0);
    expect(api.getDeliveryFailures).toHaveBeenCalledWith(expect.objectContaining({ sortBy: 'lastAttemptAt', sortDirection: 'desc', page: 1 }));
  });

  it('offers a retry only for a failed delivery that has attempts left', async () => {
    renderTable();
    await screen.findAllByText('qa@company.com');
    const retries = screen.getAllByRole('button', { name: /Retry/ }) as HTMLButtonElement[];
    expect(retries.filter((b) => !b.disabled)).toHaveLength(1);
  });

  it('retries one delivery and asks the server again', async () => {
    api.retryDeliveryFailure.mockResolvedValue(row({ status: 'RESOLVED' }));
    renderTable();
    await screen.findAllByText('qa@company.com');
    const calls = api.getDeliveryFailures.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: /Retry/ }).find((b) => !(b as HTMLButtonElement).disabled)!);
    await waitFor(() => expect(api.retryDeliveryFailure).toHaveBeenCalledWith('f1'));
    await waitFor(() => expect(api.getDeliveryFailures.mock.calls.length).toBeGreaterThan(calls));
  });
});
