import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workflow } from 'lucide-react';
import { dashboardApi } from '@/services/api/dashboard';
import { ActivityBarChart } from '../shared/ActivityBarChart';
import { describeMyWork, fillAuditDays, share } from '../shared/dashboardMetrics';
import { PanelError } from '../shared/dashboardParts';
import { Card, CardHeader, GrowthColumns, KpiStrip, PrimaryButton } from '../shared/dashboardUi';
import { DocumentsByStatusPanel } from './DocumentsByStatusPanel';
import { SystemMonitoringSection } from './SystemMonitoringSection';
import { EffectiveByTypePanel } from '../shared/EffectiveByTypePanel';
import { PendingWorkPanel } from '../shared/PendingWorkPanel';
import { useDashboardResource } from '../shared/useDashboardResource';

const dash = '—';

export function AdminDashboardView() {
  const navigate = useNavigate();
  const summary = useDashboardResource(() => dashboardApi.getSummary(), []);
  const tasks = useDashboardResource(() => dashboardApi.getPendingWorkflowActions(), []);
  const stats = useDashboardResource(() => dashboardApi.getAdminStats(), []);

  const st = stats.data;
  const work = summary.data ? describeMyWork(summary.data.myPendingTasks, tasks.data ?? []) : null;
  const awaitingAction = summary.data ? summary.data.pendingReview + summary.data.pendingApproval : undefined;

  const revision = (key: string) => st?.revisionsByStatus[key] ?? 0;
  const inFlight = st ? Object.values(st.revisionsByStatus).reduce((sum, value) => sum + value, 0) : 0;
  const inPipeline = revision('PENDING_REVIEW') + revision('PENDING_APPROVAL') + revision('PENDING_TRAINING');
  const effective = st?.documentsByStatus.ACTIVE ?? 0;
  const activeRate = st ? share(st.activeUsers, st.totalUsers) : 0;
  // Computed once per response: a new array on every render would make the chart play its entrance again each time another request lands.
  const auditSeries = useMemo(() => (st ? fillAuditDays(st.auditActivityByDay) : []), [st]);
  const auditPeak = useMemo(() => auditSeries.reduce((best, point) => (point.value > best.value ? point : best), { label: dash, value: 0 }), [auditSeries]);

  return (
    <div className="w-full space-y-4">
      {/* <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">Admin Dashboard</h1>
        </div>
      </header> */}

      <KpiStrip
        label="Users, documents and audit totals"
        cells={[
          { title: 'Total users', accent: '#10b981', value: st ? st.totalUsers : dash, chip: st ? `${activeRate}% active` : undefined, footValue: st ? st.activeUsers : dash, footLabel: 'Active users' },
          { title: 'Total documents', accent: '#059669', value: st ? st.totalDocuments : dash, chip: st ? `${share(effective, st.totalDocuments)}% effective` : undefined, footValue: st ? effective : dash, footLabel: 'Effective documents' },
          { title: 'Revisions in flight', accent: '#34d399', value: st ? inFlight : dash, footValue: st ? revision('READY_FOR_PUBLISHING') : dash, footLabel: 'Ready to publish' },
          { title: 'Audit events (30 days)', accent: '#6ee7b7', value: st ? st.auditEventsLast30Days : dash, footValue: st ? auditPeak.value : dash, footLabel: st ? `Peak day · ${auditPeak.label}` : 'Peak day' },
        ]}
      />
      {stats.error && <PanelError message="Administrative statistics could not be loaded." onRetry={stats.reload} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card aria-label="Audit activity">
          <CardHeader title="Audit activity" subtitle={st ? `${st.auditEventsLast30Days.toLocaleString()} events in the last 30 days, per UTC day` : 'Audit events per day'} />
          {st ? (
            auditSeries.some((point) => point.value > 0)
              ? <ActivityBarChart data={auditSeries} color="#10b981" valueLabel="Audit events" tickEvery={5} />
              : <p className="flex h-[232px] items-center justify-center text-sm text-slate-400">No audit events</p>
          ) : (
            <p className="flex h-[232px] items-center justify-center text-sm text-slate-400">{stats.loading ? 'Loading…' : 'Unavailable'}</p>
          )}
        </Card>

        <Card aria-label="Revision pipeline">
          <CardHeader title="Revision pipeline" subtitle={st ? `${inPipeline.toLocaleString()} in review, approval or training · ${revision('READY_FOR_PUBLISHING').toLocaleString()} ready to publish` : 'Revisions waiting in each stage'} />
          {st ? (
            <GrowthColumns
              columns={[
                { title: 'Review', value: revision('PENDING_REVIEW'), chip: `${share(revision('PENDING_REVIEW'), inPipeline)}%`, caption: 'Share of pipeline', pattern: 'hatch', tint: '#d1fae5' },
                { title: 'Approval', value: revision('PENDING_APPROVAL'), chip: `${share(revision('PENDING_APPROVAL'), inPipeline)}%`, caption: 'Share of pipeline', pattern: 'solid', tint: '#ccfbf1' },
                { title: 'Training', value: revision('PENDING_TRAINING'), chip: `${share(revision('PENDING_TRAINING'), inPipeline)}%`, caption: 'Share of pipeline', pattern: 'lines', tint: '#ecf3f0' },
              ]}
            />
          ) : (
            <p className="flex h-[250px] items-center justify-center text-sm text-slate-400">{stats.loading ? 'Loading…' : 'Unavailable'}</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EffectiveByTypePanel />
        <DocumentsByStatusPanel stats={stats} />
      </div>

      <SystemMonitoringSection />

      <PendingWorkPanel
        tasks={tasks}
        work={work}
        awaitingAction={awaitingAction}
        onOpenTask={(task) => navigate(`/documents/${task.documentId}/revisions/${task.revisionId}`)}
        onOpenAll={() => navigate('/documents/revisions')}
      />
    </div>
  );
}
