import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes.constants';
import { usePermissions } from '@/hooks/usePermissions';
import { subscribeNotificationRealtime } from '@/features/notifications/notificationRealtime';
import { dashboardApi, type DashboardSystemMonitoring } from '@/services/api/dashboard';
import { BreakdownPanel } from '../shared/BreakdownPanel';
import { formatBytes, formatUptime, share, type RankedCount } from '../shared/dashboardMetrics';
import { PanelError } from '../shared/dashboardParts';
import { Card, CardHeader, KpiStrip } from '../shared/dashboardUi';
import { useDashboardResource, type DashboardResource } from '../shared/useDashboardResource';
import { displayTime } from "@/utils/format";

const dash = '—';
/** Server-sent event (sent only to users who may see this dashboard, no data in it): the figures moved on, read them again. */
const MONITORING_EVENT = 'system-monitoring-changed';

/** One colour per user status; the same meaning as the document statuses elsewhere (grey = idle, red = ended). */
const USER_STATUS_COLOR: Record<string, string> = {
  Active: '#10b981',
  Inactive: '#94a3b8',
  Pending: '#f59e0b',
  Suspended: '#f97316',
  Terminated: '#ef4444',
};

const userStatusColor = (row: RankedCount) => USER_STATUS_COLOR[row.key] ?? '#94a3b8';

const formatChecked = (value: string) => {
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? dash : displayTime(time);
};

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2 text-[13px] last:border-b-0">
    <dt className="shrink-0 text-slate-500">{label}</dt>
    <dd className="min-w-0 truncate text-right font-medium tabular-nums text-slate-900">{children}</dd>
  </div>
);

/** Runtime facts of the server and the database; the heap bar is the real used / maximum share. */
const RuntimeCard: React.FC<{ data: DashboardSystemMonitoring | null; loading: boolean; error: boolean; onRetry: () => void; className?: string }> = ({ data, loading, error, onRetry, className }) => {
  const heap = data ? share(data.runtime.heapUsedBytes, data.runtime.heapMaxBytes) : 0;
  return (
    <Card aria-label="System runtime" className={className}>
      <CardHeader title="System runtime" subtitle={data ? `Checked at ${formatChecked(data.generatedAt)}` : 'Server and database'} />
      {error ? <PanelError message="System runtime could not be loaded." onRetry={onRetry} /> : !data ? (
        <p className="py-10 text-center text-sm text-slate-400">{loading ? 'Loading…' : 'Unavailable'}</p>
      ) : (
        <div className="px-4 pb-4 pt-2">
          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between text-[13px]">
              <span className="text-slate-500">Heap memory</span>
              <span className="font-medium tabular-nums text-slate-900">{formatBytes(data.runtime.heapUsedBytes)} of {formatBytes(data.runtime.heapMaxBytes)} · {heap}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Heap memory: ${heap}%`}>
              <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-700" style={{ width: `${heap}%` }} />
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
            <Fact label="Uptime">{formatUptime(data.runtime.uptimeMillis)}</Fact>
            <Fact label="Started">{data.runtime.startedAt}</Fact>
            <Fact label="Application version">{data.runtime.applicationVersion}</Fact>
            <Fact label="Processors">{data.runtime.availableProcessors}</Fact>
            <Fact label="Database schema">v{data.database.schemaMigrationVersion} · {data.database.appliedMigrations} migrations</Fact>
          </dl>
        </div>
      )}
    </Card>
  );
};

interface QueueRow {
  label: string;
  caption: string;
  count: number;
  /** Where to go, only when the user may open that screen. */
  to?: string;
}

/** Work that is open right now in the quality system. A count is information, not a verdict: zero is shown as "None open". */
const ComplianceCard: React.FC<{ data: DashboardSystemMonitoring | null; loading: boolean; error: boolean; onRetry: () => void }> = ({ data, loading, error, onRetry }) => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const rows: QueueRow[] = data
    ? [
        { label: 'Access reviews', caption: 'Campaigns in progress', count: data.compliance.openAccessReviews, to: hasPermission('security.access_review.view') ? ROUTES.SECURITY.ACCESS_REVIEW : undefined },
        { label: 'Audit trail reviews', caption: 'Campaigns in progress', count: data.compliance.openAuditTrailReviews, to: hasPermission('audit.review.view') ? ROUTES.AUDIT_TRAIL_REVIEW : undefined },
        { label: 'Controlled copy batches', caption: 'Open status discrepancies', count: data.compliance.openControlledCopyDiscrepancies },
      ]
    : [];
  return (
    <Card aria-label="Compliance queues">
      <CardHeader title="Compliance queues" subtitle="Reviews and discrepancies that are still open" />
      {error ? <PanelError message="Compliance queues could not be loaded." onRetry={onRetry} /> : !data ? (
        <p className="py-10 text-center text-sm text-slate-400">{loading ? 'Loading…' : 'Unavailable'}</p>
      ) : (
        <ul className="divide-y divide-slate-100 px-2 pb-2 pt-1">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 px-2 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{row.label}</p>
                <p className="truncate text-xs text-slate-500">{row.caption}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`inline-flex min-w-[28px] justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${row.count > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`} title={row.count > 0 ? `${row.count} open` : 'None open'}>
                  {row.count.toLocaleString()}
                </span>
                {row.to && (
                  <button type="button" onClick={() => navigate(row.to as string)} className="text-xs font-semibold text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                    Open
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

/**
 * "System monitoring": the figures an administrator watches to judge whether the system is healthy. They are read from the
 * server when the page opens and then update by themselves: the server announces over the existing event stream that they moved on
 * (the event carries no figures) and the screen reads them through its own authorised call. They are also read again when the
 * stream reconnects and when the tab becomes visible; nothing is read while the tab is hidden. "Checked at" shows how fresh they are.
 */
export const SystemMonitoringSection: React.FC = () => {
  const monitoring: DashboardResource<DashboardSystemMonitoring> = useDashboardResource(() => dashboardApi.getSystemMonitoring(), []);
  const { data, loading, error, reload } = monitoring;

  useEffect(() => {
    const readIfVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    const unsubscribe = subscribeNotificationRealtime((event) => {
      // 'connected' is sent each time the stream (re)opens, so anything missed while it was down is read at once.
      if (event.type === MONITORING_EVENT || event.type === 'connected') readIfVisible();
    });
    document.addEventListener('visibilitychange', readIfVisible);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', readIfVisible);
    };
  }, [reload]);

  const heap = data ? share(data.runtime.heapUsedBytes, data.runtime.heapMaxBytes) : undefined;
  const pool = data && data.database.poolActive !== null && data.database.poolMax !== null ? `${data.database.poolActive} / ${data.database.poolMax}` : dash;

  const users = useMemo<DashboardResource<RankedCount[]>>(
    () => ({
      ...monitoring,
      data: data
        ? Object.entries(data.security.usersByStatus).map(([status, value]) => ({ key: status, name: status, shortCode: status, value }))
        : null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, loading, error],
  );
  const totalUsers = Object.values(data?.security.usersByStatus ?? {}).reduce((sum, value) => sum + value, 0);

  return (
    <section aria-label="System monitoring" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium text-slate-900">System monitoring</h2>
          <p className="text-xs text-slate-500">Read from the server; updates by itself.</p>
        </div>
      </div>

      <KpiStrip
        label="Server, database and security"
        cells={[
          { title: 'Server uptime', accent: '#10b981', value: data ? formatUptime(data.runtime.uptimeMillis) : dash, chip: heap === undefined ? undefined : `${heap}% heap`, footValue: data ? formatBytes(data.runtime.heapUsedBytes) : dash, footLabel: data ? `Heap used of ${formatBytes(data.runtime.heapMaxBytes)}` : 'Heap used' },
          { title: 'Database connections', accent: '#059669', value: pool, chip: data ? `schema v${data.database.schemaMigrationVersion}` : undefined, footValue: data && data.database.poolIdle !== null ? data.database.poolIdle : dash, footLabel: 'Idle connections' },
          { title: 'Active sessions', accent: '#34d399', value: data ? data.security.activeSessions : dash, footValue: data ? data.security.lockedAccounts : dash, footLabel: 'Locked accounts' },
          { title: 'Failed logins (24 h)', accent: '#6ee7b7', value: data ? data.security.failedLogins24h : dash, footValue: data ? data.security.electronicSignatures30d : dash, footLabel: 'E-signatures (30 days)' },
        ]}
      />
      {error && !data && <PanelError message="System monitoring could not be loaded." onRetry={reload} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownPanel
          title="Users by status"
          idleSubtitle="All user accounts, per status"
          subtitle={(total) => `${total.toLocaleString()} user accounts`}
          resource={users}
          valueLabel="Users"
          centerCaption="Users"
          chartLabel="users by status"
          emptyLabel={totalUsers === 0 && data ? 'There are no user accounts' : 'No data'}
          errorMessage="Users by status could not be loaded."
          idPrefix="users-status"
          defaultView="bar"
          colorFor={userStatusColor}
        />
        <ComplianceCard data={data} loading={loading} error={error && !data} onRetry={reload} />
        <RuntimeCard className="lg:col-span-2" data={data} loading={loading} error={error && !data} onRetry={reload} />
      </div>
    </section>
  );
};
