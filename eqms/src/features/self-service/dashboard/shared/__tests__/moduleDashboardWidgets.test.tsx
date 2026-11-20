import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useModuleDashboardWidgets } from '../moduleDashboardWidgets';

const api = vi.hoisted(() => ({
  summary: vi.fn(), notifications: vi.fn(), failures: vi.fn(), counts: vi.fn(), tasks: vi.fn(), approvals: vi.fn(), records: vi.fn(), activities: vi.fn(), runs: vi.fn(), recent: vi.fn(),
}));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));
vi.mock('@/services/api/notifications', () => ({ notificationApi: { getSummary: api.summary, getNotifications: api.notifications, getDeliveryFailures: api.failures } }));
vi.mock('@/services/api/myTraining', () => ({ myTrainingApi: { counts: api.counts, tasks: api.tasks, approvals: api.approvals } }));
vi.mock('@/services/api/trainingActivities', () => ({ trainingRecordsApi: { mine: api.records }, trainingActivitiesApi: { list: api.activities } }));
vi.mock('@/services/api/reports', () => ({ reportsApi: { listRuns: api.runs } }));
vi.mock('@/services/api/dashboard', () => ({ dashboardApi: { getRecentActivity: api.recent } }));

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const Cards = ({ only }: { only?: string[] }) => {
  const widgets = useModuleDashboardWidgets();
  return <>{widgets.filter((w) => !only || only.includes(w.id)).map((w) => <div key={w.id} data-card={w.id}>{w.content}</div>)}</>;
};
const show = (only?: string[]) => render(<MemoryRouter><Cards only={only} /><Where /></MemoryRouter>);
const ids = () => {
  let found: string[] = [];
  const Probe = () => { found = useModuleDashboardWidgets().map((w) => w.id); return null; };
  render(<Probe />);
  return found;
};

beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); perms.granted = new Set(); });
afterEach(cleanup);

describe('Cards of the other modules', () => {
  it('offers each module only to a person who may use it, and keeps every one in the library', () => {
    expect(ids()).toEqual(['notifications-unread', 'notifications-recent', 'notifications-personal', 'notifications-by-type']);
    cleanup();
    perms.granted = new Set(['training.self.view', 'report.module.view', 'dashboard.admin.view']);
    expect(ids()).toEqual([
      'notifications-unread', 'notifications-recent', 'notifications-personal', 'notifications-by-type',
      'training-my-tasks', 'training-my-signatures', 'training-my-task-list', 'training-my-approval-list', 'training-my-records',
      'reports-recent-runs', 'reports-failed-runs', 'audit-recent-events',
    ]);
    cleanup();
    perms.granted = new Set(['training.activity.view', 'settings.notification_policy.manage']);
    expect(ids()).toEqual([
      'notifications-unread', 'notifications-recent', 'notifications-personal', 'notifications-by-type', 'notifications-delivery-failures',
      'training-activities-in-progress', 'training-activities-overdue', 'training-activities-awaiting-qa',
    ]);
    cleanup();
    perms.granted = new Set(['training.self.view', 'report.module.view', 'dashboard.admin.view']);
    let defaults: (boolean | undefined)[] = [];
    const Probe = () => { defaults = useModuleDashboardWidgets().map((w) => w.defaultVisible); return null; };
    cleanup();
    render(<Probe />);
    expect(defaults.every((value) => value === false)).toBe(true);
  });

  it('shows unread against all notifications, and nothing invented while it is unread', async () => {
    api.summary.mockResolvedValue({ all: 12, unread: 3, personal: 0, system: 0, byType: {} });
    show(['notifications-unread']);
    expect(await screen.findByText('Unread notifications', { selector: 'h3' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('12')).toBeTruthy());
    expect(screen.getByText('All notifications')).toBeTruthy();
  });

  it('says a failed read failed, with a retry, instead of showing zero', async () => {
    api.counts.mockRejectedValue(new Error('down'));
    perms.granted = new Set(['training.self.view']);
    show(['training-my-tasks']);
    expect(await screen.findByRole('button', { name: /Try again/ })).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('lists the newest notifications and opens the one chosen at its own page', async () => {
    api.notifications.mockResolvedValue({ data: [
      { id: 'n1', title: 'Review asked', description: 'DOC-1 needs review', createdAt: '2026-11-19T01:00:00Z', readAt: null, actionUrl: '/documents/1' },
      { id: 'n2', title: 'Done', description: 'Published', createdAt: '2026-11-18T01:00:00Z', readAt: '2026-11-18T02:00:00Z' },
    ] });
    show(['notifications-recent']);
    fireEvent.click(await screen.findByRole('button', { name: /Review asked/ }));
    expect(screen.getByTestId('where').textContent).toBe('/documents/1');
    expect(api.notifications).toHaveBeenCalledWith({ page: 1, limit: 5 });
  });

  it('counts a dead-lettered report run as a failed one, and says how many of them there are', async () => {
    perms.granted = new Set(['report.module.view']);
    api.runs.mockImplementation(async (params: { status?: string }) => ({ data: [], pagination: { page: 1, limit: 1, total: params.status === 'FAILED' ? 2 : 1, totalPages: 1 } }));
    show(['reports-failed-runs']);
    const card = await screen.findByRole('region', { name: 'Failed report runs' });
    await waitFor(() => expect(within(card).getByText('3')).toBeTruthy());
    expect(within(card).getByText('Dead-lettered')).toBeTruthy();
  });

  it('lists the newest report runs with how each ended', async () => {
    perms.granted = new Set(['report.module.view']);
    api.runs.mockResolvedValue({ data: [{ id: 'r1', reportTitle: 'Users report', definitionCode: 'USERS', status: 'COMPLETED', queuedAt: '2026-11-19T01:00:00Z', completedAt: '2026-11-19T01:01:00Z' }], pagination: { page: 1, limit: 5, total: 1, totalPages: 1 } });
    show(['reports-recent-runs']);
    fireEvent.click(await screen.findByRole('button', { name: /Users report/ }));
    expect(screen.getByTestId('where').textContent).toBe('/report/runs/r1');
  });

  it('says when there is nothing to list', async () => {
    perms.granted = new Set(['dashboard.admin.view']);
    api.recent.mockResolvedValue([]);
    show(['audit-recent-events']);
    expect(await screen.findByText('No audit events.')).toBeTruthy();
  });
  it('ranks the kinds of notification by how many there are', async () => {
    api.summary.mockResolvedValue({ all: 9, unread: 1, personal: 4, system: 5, byType: { DOCUMENT_REVIEW: 2, TRAINING_DUE: 6, EMPTY_ONE: 0 } });
    show(['notifications-by-type']);
    const card = await screen.findByRole('region', { name: 'Notifications by type' });
    await waitFor(() => expect(within(card).getAllByRole('listitem')).toHaveLength(2)); // a kind with none is not listed
    expect(within(card).getAllByRole('listitem')[0].textContent).toContain('Training due');
  });

  it('counts the failed deliveries from the server total', async () => {
    perms.granted = new Set(['settings.notification_policy.manage']);
    api.failures.mockResolvedValue({ data: [], pagination: { page: 1, limit: 1, total: 4, totalPages: 4 } });
    show(['notifications-delivery-failures']);
    const card = await screen.findByRole('region', { name: 'Failed notification deliveries' });
    await waitFor(() => expect(within(card).getByText('4')).toBeTruthy());
  });

  it('lists my trainings with their due day, and opens the list of my tasks', async () => {
    perms.granted = new Set(['training.self.view']);
    api.tasks.mockResolvedValue({ data: [{ participantId: 'p1', activityId: 'a1', trainingNumber: 'TR-0001', status: 'NOTIFIED', dueDate: '2026-12-01', method: 'SELF_READING', state: 'TO_READ', topics: 'SOP.0003' }], pagination: { page: 1, limit: 5, total: 1, totalPages: 1 } });
    show(['training-my-task-list']);
    fireEvent.click(await screen.findByRole('button', { name: /TR-0001/ }));
    expect(screen.getByTestId('where').textContent).toBe('/training-management/my-training/tasks');
    expect(api.tasks).toHaveBeenCalledWith({ page: 1, limit: 5 });
  });

  it('lists the signatures asked of me and my recent records, a voided record marked as voided', async () => {
    perms.granted = new Set(['training.self.view']);
    api.approvals.mockResolvedValue({ data: [{ id: 's1', stepCode: 'QA_CONFIRM', objectType: 'ACTIVITY', objectId: 'a1', trainingNumber: 'TR-0002', subject: 'Confirm training', status: 'PENDING_QA_CONFIRMATION', assignedAt: '2026-11-19T01:00:00Z' }], pagination: { page: 1, limit: 5, total: 1, totalPages: 1 } });
    api.records.mockResolvedValue({ data: [{ id: 'r1', trainingNumber: 'TR-0003', topicText: 'GMP basics', completedOn: '2026-11-10', result: 'PASSED', voidedAt: '2026-11-11T00:00:00Z' }], pagination: { page: 1, limit: 5, total: 1, totalPages: 1 } });
    show(['training-my-approval-list', 'training-my-records']);
    expect(await screen.findByText('Confirm training')).toBeTruthy();
    expect(await screen.findByText('Voided')).toBeTruthy();
  });

  it('counts training activities by the server total for each filter', async () => {
    perms.granted = new Set(['training.activity.view']);
    api.activities.mockImplementation(async (params: Record<string, unknown>) => ({ data: [], pagination: { page: 1, limit: 1, total: params.overdue ? 7 : params.status === 'IN_PROGRESS' ? 3 : 2, totalPages: 1 } }));
    show(['training-activities-in-progress', 'training-activities-overdue', 'training-activities-awaiting-qa']);
    const overdue = await screen.findByRole('region', { name: 'Overdue training activities' });
    await waitFor(() => expect(within(overdue).getByText('7')).toBeTruthy());
    expect(api.activities).toHaveBeenCalledWith({ status: 'IN_PROGRESS', page: 1, limit: 1 });
    expect(api.activities).toHaveBeenCalledWith({ status: 'PENDING_QA_CONFIRMATION', page: 1, limit: 1 });
  });
});
