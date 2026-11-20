import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes.constants';
import { Badge } from '@/components/ui/badge/Badge';
import { Button } from '@/components/ui/button/Button';
import { cn } from '@/components/ui/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { dashboardApi } from '@/services/api/dashboard';
import { notificationApi } from '@/services/api/notifications';
import { myTrainingApi } from '@/services/api/myTraining';
import { trainingActivitiesApi, trainingRecordsApi } from '@/services/api/trainingActivities';
import { reportsApi } from '@/services/api/reports';
import { humanize, runStatusColor, runStatusLabel } from '@/features/report/shared/reportLabels';
import { formatDate, formatDateTime } from '@/utils/format';
import { PanelError, RowsSkeleton } from './dashboardParts';
import { Card, CardHeader, KpiStrip, type KpiCellData } from './dashboardUi';
import { useDashboardResource, type DashboardResource } from './useDashboardResource';
import type { DashboardWidget } from './DashboardWidgets';

const dash = '—';
const LIST_ROWS = 5;

/** One figure from one read. Until it is read it shows a dash, and a failed read says so with a retry, never a zero. */
function KpiCard<T>({ label, resource, cell }: { label: string; resource: DashboardResource<T>; cell: (data: T) => KpiCellData }) {
  const shown: KpiCellData = resource.data ? cell(resource.data) : { title: label, accent: '#94a3b8', value: dash, footValue: dash, footLabel: resource.loading ? 'Loading…' : 'Unavailable' };
  return (
    <>
      <KpiStrip label={label} className="!grid-cols-1" cells={[shown]} />
      {resource.error && <PanelError message={`${label} could not be loaded.`} onRetry={resource.reload} />}
    </>
  );
}

type Row = { id: string; title: string; detail?: string; at?: string; badge?: ReactNode; unread?: boolean; onOpen?: () => void };

/** The newest few of something, one line each. Empty says so; a failed read says so with a retry. */
function RecentCard({ title, subtitle, rows, loading, error, onRetry, empty, openAll }: {
  title: string; subtitle: string; rows: Row[] | null; loading: boolean; error: boolean; onRetry: () => void; empty: string; openAll?: { label: string; onClick: () => void };
}) {
  return (
    <Card aria-label={title}>
      <CardHeader title={title} subtitle={subtitle} right={openAll && <Button size="sm" variant="outline" onClick={openAll.onClick}>{openAll.label}</Button>} />
      {error ? (
        <PanelError message={`${title} could not be loaded.`} onRetry={onRetry} />
      ) : !rows ? (
        loading ? <RowsSkeleton rows={LIST_ROWS} /> : null
      ) : rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 pt-2">
          {rows.map((row) => {
            const body = (
              <>
                <span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', row.unread ? 'bg-emerald-500' : 'bg-transparent')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{row.title}</span>
                  {row.detail && <span className="mt-0.5 block truncate text-xs text-slate-500">{row.detail}</span>}
                </span>
                {row.badge}
                {row.at && <span className="hidden shrink-0 text-xs tabular-nums text-slate-500 sm:block">{formatDateTime(row.at)}</span>}
              </>
            );
            return (
              <li key={row.id}>
                {row.onOpen ? (
                  <Button variant="ghost" fullWidth onClick={row.onOpen} className="h-auto items-start justify-start gap-3 rounded-none px-4 py-2.5 text-left font-normal">{body}</Button>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const NotificationsUnread = () => {
  const summary = useDashboardResource(() => notificationApi.getSummary(), []);
  return <KpiCard label="Unread notifications" resource={summary} cell={(n) => ({ title: 'Unread notifications', accent: '#10b981', value: n.unread, footValue: n.all, footLabel: 'All notifications' })} />;
};

const NotificationsRecent = () => {
  const navigate = useNavigate();
  const list = useDashboardResource(() => notificationApi.getNotifications({ page: 1, limit: LIST_ROWS }), []);
  const rows = list.data?.data.slice(0, LIST_ROWS).map<Row>((n) => ({
    id: n.id, title: n.title, detail: n.description, at: n.createdAt, unread: !n.readAt,
    onOpen: () => navigate(n.actionUrl || ROUTES.NOTIFICATIONS),
  })) ?? null;
  return <RecentCard title="Recent notifications" subtitle="Your newest notifications" rows={rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="You have no notifications." openAll={{ label: 'Open all', onClick: () => navigate(ROUTES.NOTIFICATIONS) }} />;
};

const TrainingCount = ({ field, label, accent, foot }: { field: 'tasks' | 'signatures'; label: string; accent: string; foot: { field: 'tasks' | 'signatures'; label: string } }) => {
  const counts = useDashboardResource(() => myTrainingApi.counts(), []);
  return <KpiCard label={label} resource={counts} cell={(c) => ({ title: label, accent, value: c[field], footValue: c[foot.field], footLabel: foot.label })} />;
};

const NotificationsPersonal = () => {
  const summary = useDashboardResource(() => notificationApi.getSummary(), []);
  return <KpiCard label="Personal notifications" resource={summary} cell={(n) => ({ title: 'Personal notifications', accent: '#14b8a6', value: n.personal, footValue: n.system, footLabel: 'System notifications' })} />;
};

const NotificationsByType = () => {
  const summary = useDashboardResource(() => notificationApi.getSummary(), []);
  const rows = summary.data
    ? Object.entries(summary.data.byType).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, LIST_ROWS)
        .map<Row>(([type, count]) => ({ id: type, title: humanize(type), badge: <Badge color="slate" size="sm">{count.toLocaleString()}</Badge> }))
    : null;
  return <RecentCard title="Notifications by type" subtitle="Which kinds you have, most frequent first" rows={rows} loading={summary.loading} error={summary.error} onRetry={summary.reload} empty="You have no notifications." />;
};

const NotificationsDeliveryFailures = () => {
  const failures = useDashboardResource(() => notificationApi.getDeliveryFailures({ page: 1, limit: 1 }), []);
  return <KpiCard label="Failed notification deliveries" resource={failures} cell={(f) => ({ title: 'Failed notification deliveries', accent: f.pagination.total > 0 ? '#ef4444' : '#10b981', value: f.pagination.total, footValue: dash, footLabel: 'Listed on the notification policy screen' })} />;
};

const TrainingTaskList = () => {
  const navigate = useNavigate();
  const tasks = useDashboardResource(() => myTrainingApi.tasks({ page: 1, limit: LIST_ROWS }), []);
  const rows = tasks.data?.data.slice(0, LIST_ROWS).map<Row>((task) => ({
    id: task.participantId, title: task.trainingNumber,
    detail: [task.topics, task.dueDate ? `Due ${formatDate(task.dueDate)}` : null].filter(Boolean).join(' · ') || undefined,
    badge: <Badge color="slate" size="sm">{humanize(task.state)}</Badge>,
    onOpen: () => navigate(ROUTES.TRAINING.MY_TASKS),
  })) ?? null;
  return <RecentCard title="My trainings to do" subtitle="Your waiting trainings and their due days" rows={rows} loading={tasks.loading} error={tasks.error} onRetry={tasks.reload} empty="No training is waiting for you." openAll={{ label: 'Open all', onClick: () => navigate(ROUTES.TRAINING.MY_TASKS) }} />;
};

const TrainingApprovalList = () => {
  const navigate = useNavigate();
  const approvals = useDashboardResource(() => myTrainingApi.approvals({ page: 1, limit: LIST_ROWS }), []);
  const rows = approvals.data?.data.slice(0, LIST_ROWS).map<Row>((item) => ({
    id: item.id, title: item.trainingNumber || item.subject, detail: item.subject, at: item.assignedAt,
    onOpen: () => navigate(ROUTES.TRAINING.MY_TASKS),
  })) ?? null;
  return <RecentCard title="Training signatures asked of me" subtitle="What you are asked to sign, newest first" rows={rows} loading={approvals.loading} error={approvals.error} onRetry={approvals.reload} empty="Nothing is waiting for your signature." openAll={{ label: 'Open all', onClick: () => navigate(ROUTES.TRAINING.MY_TASKS) }} />;
};

const TrainingMyRecords = () => {
  const navigate = useNavigate();
  const records = useDashboardResource(() => trainingRecordsApi.mine({ page: 1, limit: LIST_ROWS }), []);
  const rows = records.data?.data.slice(0, LIST_ROWS).map<Row>((record) => ({
    id: record.id, title: record.trainingNumber, detail: record.topicText, at: record.completedOn,
    badge: <Badge color={record.voidedAt ? 'red' : 'emerald'} size="sm">{record.voidedAt ? 'Voided' : humanize(record.result)}</Badge>,
    onOpen: () => navigate(ROUTES.TRAINING.MY_RECORDS),
  })) ?? null;
  return <RecentCard title="My recent training records" subtitle="The trainings you completed most recently" rows={rows} loading={records.loading} error={records.error} onRetry={records.reload} empty="You have no training record yet." openAll={{ label: 'Open all', onClick: () => navigate(ROUTES.TRAINING.MY_RECORDS) }} />;
};

/** How many training activities the server finds for a filter; the figure is the server's own total, not a count of rows loaded. */
const ActivityCount = ({ label, accent, filter, foot }: { label: string; accent: string; filter: Record<string, string | boolean>; foot: string }) => {
  const total = useDashboardResource(() => trainingActivitiesApi.list({ ...filter, page: 1, limit: 1 }).then((page) => page.pagination.total), []);
  return <KpiCard label={label} resource={total} cell={(value) => ({ title: label, accent, value, footValue: dash, footLabel: foot })} />;
};

const ReportsRecentRuns = () => {
  const navigate = useNavigate();
  const runs = useDashboardResource(() => reportsApi.listRuns({ page: 1, limit: LIST_ROWS, sortBy: 'queuedAt', sortDirection: 'desc' }), []);
  const rows = runs.data?.data.slice(0, LIST_ROWS).map<Row>((run) => ({
    id: run.id, title: run.reportTitle || run.definitionCode, detail: run.artifactFilename, at: run.completedAt ?? run.queuedAt,
    badge: <Badge color={runStatusColor(run.status)} size="sm">{runStatusLabel(run.status)}</Badge>,
    onOpen: () => navigate(`/report/runs/${run.id}`),
  })) ?? null;
  return <RecentCard title="Recent report runs" subtitle="The newest runs and how each ended" rows={rows} loading={runs.loading} error={runs.error} onRetry={runs.reload} empty="No report has been run." openAll={{ label: 'Open all', onClick: () => navigate(ROUTES.REPORT.HISTORY) }} />;
};

/** A run that ended badly is Failed, or Dead-lettered once its retries are used up; both count. */
const ReportsFailedRuns = () => {
  const failed = useDashboardResource(async () => {
    const [failedRuns, deadLettered] = await Promise.all(['FAILED', 'DEAD_LETTERED'].map((status) => reportsApi.listRuns({ status, page: 1, limit: 1 })));
    return { failed: failedRuns.pagination.total, deadLettered: deadLettered.pagination.total };
  }, []);
  return <KpiCard label="Failed report runs" resource={failed} cell={(f) => ({ title: 'Failed report runs', accent: f.failed + f.deadLettered > 0 ? '#ef4444' : '#10b981', value: f.failed + f.deadLettered, footValue: f.deadLettered, footLabel: 'Dead-lettered' })} />;
};

const AuditRecentEvents = () => {
  const recent = useDashboardResource(() => dashboardApi.getRecentActivity(), []);
  const rows = recent.data?.slice(0, LIST_ROWS).map<Row>((event) => ({
    id: event.id,
    title: [event.entityType, event.entityCode || event.entityName].filter(Boolean).join(' · '),
    detail: `${event.action}${event.fromStatus || event.toStatus ? ` (${event.fromStatus ?? dash} → ${event.toStatus ?? dash})` : ''} · ${event.userFullName || 'System'}`,
    at: event.eventTime,
  })) ?? null;
  return <RecentCard title="Recent audit events" subtitle="The newest events written to the audit trail" rows={rows} loading={recent.loading} error={recent.error} onRetry={recent.reload} empty="No audit events." />;
};

/**
 * Cards of the other modules. A card is listed only for a person who may use its module, by the permission of that module's own menu
 * (the server checks again on every read); all of them are in the widget library and none is on a dashboard until it is added.
 */
export function useModuleDashboardWidgets(): DashboardWidget[] {
  const { hasPermission } = usePermissions();
  const training = hasPermission('training.self.view');
  const reports = hasPermission('report.module.view');
  const admin = hasPermission('dashboard.admin.view');
  const activities = hasPermission('training.activity.view');
  const notificationPolicy = hasPermission('settings.notification_policy.manage');
  return useMemo<DashboardWidget[]>(() => {
    const off = { defaultVisible: false } as const;
    return [
      { id: 'notifications-unread', label: 'Unread notifications', width: 'half', ...off, content: <NotificationsUnread /> },
      { id: 'notifications-recent', label: 'Recent notifications', width: 'full', ...off, content: <NotificationsRecent /> },
      { id: 'notifications-personal', label: 'Personal notifications', width: 'half', ...off, content: <NotificationsPersonal /> },
      { id: 'notifications-by-type', label: 'Notifications by type', width: 'half', ...off, content: <NotificationsByType /> },
      ...(notificationPolicy ? [{ id: 'notifications-delivery-failures', label: 'Failed notification deliveries', width: 'half' as const, ...off, content: <NotificationsDeliveryFailures /> }] : []),
      ...(training ? [
        { id: 'training-my-tasks', label: 'My training tasks', width: 'half' as const, ...off, content: <TrainingCount field="tasks" label="My training tasks" accent="#14b8a6" foot={{ field: 'signatures', label: 'Signatures asked of you' }} /> },
        { id: 'training-my-signatures', label: 'Training signatures asked of me', width: 'half' as const, ...off, content: <TrainingCount field="signatures" label="Signatures asked of me" accent="#059669" foot={{ field: 'tasks', label: 'Trainings to do' }} /> },
        { id: 'training-my-task-list', label: 'My trainings to do', width: 'full' as const, ...off, content: <TrainingTaskList /> },
        { id: 'training-my-approval-list', label: 'Training signatures asked of me (list)', width: 'full' as const, ...off, content: <TrainingApprovalList /> },
        { id: 'training-my-records', label: 'My recent training records', width: 'full' as const, ...off, content: <TrainingMyRecords /> },
      ] : []),
      ...(activities ? [
        { id: 'training-activities-in-progress', label: 'Training activities in progress', width: 'half' as const, ...off, content: <ActivityCount label="Training activities in progress" accent="#10b981" filter={{ status: 'IN_PROGRESS' }} foot="Started, not finished" /> },
        { id: 'training-activities-overdue', label: 'Overdue training activities', width: 'half' as const, ...off, content: <ActivityCount label="Overdue training activities" accent="#ef4444" filter={{ overdue: true }} foot="Past their due date" /> },
        { id: 'training-activities-awaiting-qa', label: 'Trainings awaiting QA confirmation', width: 'half' as const, ...off, content: <ActivityCount label="Awaiting QA confirmation" accent="#f59e0b" filter={{ status: 'PENDING_QA_CONFIRMATION' }} foot="Waiting for QA" /> },
      ] : []),
      ...(reports ? [
        { id: 'reports-recent-runs', label: 'Recent report runs', width: 'full' as const, ...off, content: <ReportsRecentRuns /> },
        { id: 'reports-failed-runs', label: 'Failed report runs', width: 'half' as const, ...off, content: <ReportsFailedRuns /> },
      ] : []),
      ...(admin ? [{ id: 'audit-recent-events', label: 'Recent audit events', width: 'full' as const, ...off, content: <AuditRecentEvents /> }] : []),
    ];
  }, [training, reports, admin, activities, notificationPolicy]);
}
