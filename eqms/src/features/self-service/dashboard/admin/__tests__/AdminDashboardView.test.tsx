import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardAdminStats, DashboardPendingWorkflowAction, DashboardSummary, DashboardSystemMonitoring } from '@/services/api/dashboard';

const api = vi.hoisted(() => ({
  getSummary: vi.fn(),
  getPendingWorkflowActions: vi.fn(),
  getDocumentActivity: vi.fn(),
  getAdminStats: vi.fn(),
  getRecentActivity: vi.fn(),
  getEffectiveDocumentsByType: vi.fn(),
  getSystemMonitoring: vi.fn(),
}));
const permissions = vi.hoisted(() => ({ granted: new Set<string>() }));

const documents = vi.hoisted(() => ({ getDocumentsPage: vi.fn() }));
const realtime = vi.hoisted(() => ({ listeners: new Set<(event: { type: string; data: string }) => void>() }));

vi.mock('@/services/api/dashboard', () => ({ dashboardApi: api }));
vi.mock('@/features/notifications/notificationRealtime', () => ({
  subscribeNotificationRealtime: (listener: (event: { type: string; data: string }) => void) => {
    realtime.listeners.add(listener);
    return () => { realtime.listeners.delete(listener); };
  },
}));
const emit = (type: string) => act(async () => { realtime.listeners.forEach((listener) => listener({ type, data: '{}' })); });
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: (code: string) => permissions.granted.has(code) }) }));
vi.mock('@/services/api/documents', () => ({ documentApi: documents }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { firstName: 'Ada', lastName: 'Lovelace', username: 'ada' } }) }));
vi.mock('@/features/documents/shared/useDocumentPermissions', () => ({ useDocumentPermissions: () => ({ canCreateDocumentShell: true }) }));

import { AdminDashboardView } from '../AdminDashboardView';

const task = (id: number, taskType: 'REVIEW' | 'APPROVAL' = 'REVIEW'): DashboardPendingWorkflowAction => ({
  revisionId: `r${id}`, documentId: `d${id}`, documentNumber: `SOP-${id}`, documentName: `Procedure ${id}`,
  revisionNumber: '1', status: 'PENDING_REVIEW', taskType, createdAt: '2026-10-01T00:00:00Z',
});

// Field names mirror com.eqms.dto.dashboard.DashboardSummaryResponse.
const summary: DashboardSummary = {
  totalEffectiveDocuments: 30, pendingReview: 40, pendingApproval: 30, pendingTraining: 5, myPendingTasks: 35, totalDocuments: 100,
};

const stats: DashboardAdminStats = {
  totalUsers: 10, activeUsers: 7, inactiveUsers: 3, totalDocuments: 100,
  documentsByStatus: { ACTIVE: 60, DRAFT: 20, OBSOLETED: 5, CLOSED_CANCELLED: 5 },
  revisionsByStatus: { PENDING_REVIEW: 4, PENDING_APPROVAL: 2, PENDING_TRAINING: 1, READY_FOR_PUBLISHING: 3 },
  auditEventsLast30Days: 12, auditActivityByDay: [{ label: '01 Oct', value: 12 }],
};

// Field names mirror com.eqms.dto.dashboard.DashboardSystemMonitoringResponse.
const monitoring: DashboardSystemMonitoring = {
  generatedAt: '2026-10-07T10:00:00Z',
  runtime: { applicationVersion: '1.2.3', startedAt: '06/10/2026 10:00', uptimeMillis: (3 * 24 * 60 + 4 * 60 + 9) * 60_000, heapUsedBytes: 400 * 1024 * 1024, heapMaxBytes: 1000 * 1024 * 1024, availableProcessors: 8 },
  database: { schemaMigrationVersion: '551', appliedMigrations: 551, poolActive: 3, poolIdle: 7, poolMax: 10 },
  security: { usersByStatus: { Active: 7, Inactive: 1, Pending: 1, Suspended: 1, Terminated: 0 }, lockedAccounts: 1, activeSessions: 5, failedLogins24h: 9, electronicSignatures30d: 40 },
  compliance: { openAccessReviews: 2, openAuditTrailReviews: 0, openControlledCopyDiscrepancies: 4 },
};

const renderInRouter = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getDocumentActivity.mockResolvedValue([]);
  api.getEffectiveDocumentsByType.mockResolvedValue([]);
  api.getSystemMonitoring.mockResolvedValue(monitoring);
  permissions.granted = new Set();
  documents.getDocumentsPage.mockReset();
  documents.getDocumentsPage.mockResolvedValue({ data: [], pagination: { page: 1, limit: 1, total: 0, totalPages: 0 } });
});

describe('AdminDashboardView figures', () => {
  it('reports statuses outside the listed codes as Other and ties percentages to the total', async () => {
    api.getSummary.mockResolvedValue(summary);
    api.getPendingWorkflowActions.mockResolvedValue([]);
    api.getAdminStats.mockResolvedValue({ ...stats, totalDocuments: 110 });
    renderInRouter(<AdminDashboardView />);

    const byStatus = await screen.findByRole('region', { name: 'Documents by status' });
    expect(await within(byStatus).findByText('Other')).toBeInTheDocument();
    expect(within(byStatus).getByText('110 total')).toBeInTheDocument();
    expect(await screen.findByText('55% effective')).toBeInTheDocument(); // 60 of 110, not of the 100 the other counts add up to
  });

  it('derives pipeline shares from review, approval and training only', async () => {
    api.getSummary.mockResolvedValue(summary);
    api.getPendingWorkflowActions.mockResolvedValue([]);
    api.getAdminStats.mockResolvedValue(stats);
    renderInRouter(<AdminDashboardView />);
    expect(await screen.findByRole('img', { name: 'Review: 4, Share of pipeline' })).toBeInTheDocument();
    expect(screen.getByText('7 in review, approval or training · 3 ready to publish')).toBeInTheDocument();
    expect(screen.getByText('70% active')).toBeInTheDocument();
  });

  it('keeps the page usable when admin stats fail', async () => {
    api.getSummary.mockResolvedValue(summary);
    api.getPendingWorkflowActions.mockResolvedValue([]);
    api.getAdminStats.mockRejectedValue(new Error('boom'));
    renderInRouter(<AdminDashboardView />);
    expect(await screen.findByText('Administrative statistics could not be loaded.')).toBeInTheDocument();
    expect(await screen.findByText(/^35 assigned to you/)).toBeInTheDocument();
  });

  it('lists the pending work with the document and status of each item', async () => {
    api.getSummary.mockResolvedValue({ ...summary, myPendingTasks: 1 });
    api.getPendingWorkflowActions.mockResolvedValue([
      { ...task(7, 'APPROVAL'), status: 'PENDING_APPROVAL', documentName: 'Cleaning SOP', documentNumber: 'SOP-7' },
    ]);
    api.getAdminStats.mockResolvedValue(stats);
    renderInRouter(<AdminDashboardView />);
    expect(await screen.findByText('Cleaning SOP')).toBeInTheDocument();
    expect(screen.getByText('SOP-7 · Revision 1')).toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    expect(api.getRecentActivity).not.toHaveBeenCalled();
  });

  it('keeps the table header pinned while the rows scroll', async () => {
    api.getSummary.mockResolvedValue(summary);
    api.getPendingWorkflowActions.mockResolvedValue([task(1)]);
    api.getAdminStats.mockResolvedValue(stats);
    renderInRouter(<AdminDashboardView />);
    const header = await screen.findByRole('columnheader', { name: 'Document' });
    expect(header.className).toContain('sticky');
    expect(header.className).toContain('top-0');
    expect(header.closest('div')?.className).toContain('overflow-y-auto');
  });

  it('lists every document status, including those with no document, in the redesigned card', async () => {
    api.getSummary.mockResolvedValue(summary);
    api.getPendingWorkflowActions.mockResolvedValue([]);
    api.getAdminStats.mockResolvedValue({ ...stats, documentsByStatus: { ACTIVE: 60, DRAFT: 40, OBSOLETED: 0, CLOSED_CANCELLED: 0 } });
    renderInRouter(<AdminDashboardView />);

    const byStatus = await screen.findByRole('region', { name: 'Documents by status' });
    await within(byStatus).findByText('100 total');
    expect(within(byStatus).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Effective6060%', 'Draft4040%', 'Cancelled00%', 'Obsolete00%',
    ]);
    expect(within(byStatus).getByRole('tab', { name: /Donut/ })).toBeInTheDocument();
  });
});

describe('AdminDashboardView system monitoring', () => {
  const open = async () => {
    api.getSummary.mockResolvedValue(summary);
    api.getPendingWorkflowActions.mockResolvedValue([]);
    api.getAdminStats.mockResolvedValue(stats);
    renderInRouter(<AdminDashboardView />);
    return screen.findByRole('region', { name: 'Server, database and security' });
  };

  it('shows the real server, database and security figures', async () => {
    const strip = await open();
    expect(await within(strip).findByText('3d 4h')).toBeInTheDocument(); // 3 days 4 h 9 min
    expect(within(strip).getByText('40% heap')).toBeInTheDocument(); // 400 of 1000 MB
    expect(within(strip).getByText('Heap used of 1000 MB')).toBeInTheDocument();
    expect(within(strip).getByText('3 / 10')).toBeInTheDocument(); // active / max connections
    expect(within(strip).getByText('schema v551')).toBeInTheDocument();
    expect(within(strip).getByText('Idle connections').previousElementSibling).toHaveTextContent('7');
    expect(within(strip).getByLabelText('5')).toBeInTheDocument(); // active sessions
    expect(within(strip).getByText('Locked accounts').previousElementSibling).toHaveTextContent('1');
    expect(within(strip).getByLabelText('9')).toBeInTheDocument(); // failed logins, 24 h
    expect(within(strip).getByText('E-signatures (30 days)').previousElementSibling).toHaveTextContent('40');
  });

  it('does not invent connection-pool numbers when the pool is not reported', async () => {
    api.getSystemMonitoring.mockResolvedValue({ ...monitoring, database: { ...monitoring.database, poolActive: null, poolIdle: null, poolMax: null } });
    const strip = await open();
    await within(strip).findByText('3d 4h');
    expect(within(strip).queryByText('3 / 10')).toBeNull();
    expect(within(strip).getByText('Idle connections').previousElementSibling).toHaveTextContent('—');
  });

  it('lists every user status, largest first, with its share of all accounts', async () => {
    await open();
    const users = await screen.findByRole('region', { name: 'Users by status' });
    await within(users).findByText('10 user accounts');
    expect(within(users).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Active770%', 'Inactive110%', 'Pending110%', 'Suspended110%', 'Terminated00%',
    ]);
  });

  it('shows each open queue and links only to screens the administrator may open', async () => {
    permissions.granted = new Set(['security.access_review.view']);
    await open();
    const queues = await screen.findByRole('region', { name: 'Compliance queues' });
    await within(queues).findByText('Access reviews');
    const row = (label: string) => within(queues).getByText(label).closest('li') as HTMLElement;

    expect(within(row('Access reviews')).getByText('2')).toBeInTheDocument();
    expect(within(row('Audit trail reviews')).getByTitle('None open')).toHaveTextContent('0');
    expect(within(row('Controlled copy batches')).getByText('4')).toBeInTheDocument();
    expect(within(row('Access reviews')).getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(within(row('Audit trail reviews')).queryByRole('button', { name: 'Open' })).toBeNull();
    expect(within(row('Controlled copy batches')).queryByRole('button', { name: 'Open' })).toBeNull();
  });

  it('shows the runtime facts and the time they were read', async () => {
    await open();
    const runtime = await screen.findByRole('region', { name: 'System runtime' });
    await within(runtime).findByText('1.2.3');
    expect(within(runtime).getByText('v551 · 551 migrations')).toBeInTheDocument();
    expect(within(runtime).getByRole('img', { name: 'Heap memory: 40%' })).toBeInTheDocument();
    expect(within(runtime).getByText(/^Checked at /)).toBeInTheDocument();
  });

  it('has no Refresh button: the figures update by themselves', async () => {
    await open();
    await screen.findByRole('region', { name: 'System runtime' });
    expect(screen.queryByRole('button', { name: /Refresh/ })).toBeNull();
    expect(screen.getByText(/updates by itself/)).toBeInTheDocument();
  });

  it('reads again each time the server announces that the figures moved on, over the event stream', async () => {
    await open();
    await screen.findByRole('region', { name: 'System runtime' });
    expect(api.getSystemMonitoring).toHaveBeenCalledTimes(1);

    await emit('system-monitoring-changed');
    await vi.waitFor(() => expect(api.getSystemMonitoring).toHaveBeenCalledTimes(2));
    await emit('system-monitoring-changed');
    await vi.waitFor(() => expect(api.getSystemMonitoring).toHaveBeenCalledTimes(3));
  });

  it('reads again when the stream reconnects, ignores other events, and stops listening when the page is left', async () => {
    api.getSummary.mockResolvedValue(summary);
    api.getPendingWorkflowActions.mockResolvedValue([]);
    api.getAdminStats.mockResolvedValue(stats);
    const { unmount } = renderInRouter(<AdminDashboardView />);
    await vi.waitFor(() => expect(api.getSystemMonitoring).toHaveBeenCalledTimes(1));

    await emit('entity-changed');
    await emit('ping');
    expect(api.getSystemMonitoring).toHaveBeenCalledTimes(1);

    await emit('connected'); // the stream (re)opened: whatever was missed is read now
    await vi.waitFor(() => expect(api.getSystemMonitoring).toHaveBeenCalledTimes(2));

    const listening = realtime.listeners.size;
    unmount();
    expect(realtime.listeners.size).toBeLessThan(listening);
    await emit('system-monitoring-changed');
    expect(api.getSystemMonitoring).toHaveBeenCalledTimes(2);
  });

  it('reads nothing while the tab is hidden and reads again at once when it is shown', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    try {
      await open();
      await screen.findByRole('region', { name: 'System runtime' });
      const before = api.getSystemMonitoring.mock.calls.length;

      visibility.mockReturnValue('hidden');
      await emit('system-monitoring-changed');
      expect(api.getSystemMonitoring).toHaveBeenCalledTimes(before);

      visibility.mockReturnValue('visible');
      await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
      await vi.waitFor(() => expect(api.getSystemMonitoring).toHaveBeenCalledTimes(before + 1));
    } finally {
      visibility.mockRestore();
    }
  });

  it('says so and offers a retry when monitoring cannot be read, without blanking the rest of the page', async () => {
    api.getSystemMonitoring.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(monitoring);
    const strip = await open();
    expect(await screen.findByText('System monitoring could not be loaded.')).toBeInTheDocument();
    expect(within(strip).getAllByText('—').length).toBeGreaterThanOrEqual(4); // dashes, never zeros
    expect(await screen.findByText('70% active')).toBeInTheDocument(); // the rest of the page still works

    fireEvent.click(screen.getAllByRole('button', { name: /Try again/ })[0]);
    expect(await within(strip).findByText('3d 4h')).toBeInTheDocument();
  });
});
