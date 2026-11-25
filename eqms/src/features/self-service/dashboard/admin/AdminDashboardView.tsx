import { useMemo, useState } from 'react';
import { useDebounce } from '@/hooks';
import { useNavigate } from 'react-router-dom';
import { Workflow } from 'lucide-react';
import { dashboardApi } from '@/services/api/dashboard';
import { ActivityBarChart } from '../shared/ActivityBarChart';
import { describeMyWork, fillAuditDays, share } from '../shared/dashboardMetrics';
import { PanelError } from '../shared/dashboardParts';
import { Card, CardHeader, GrowthColumns, KpiStrip, PrimaryButton } from '../shared/dashboardUi';
import { DocumentsByStatusPanel } from './DocumentsByStatusPanel';
import { useSystemMonitoringWidgets } from './SystemMonitoringSection';
import { EffectiveByTypePanel } from '../shared/EffectiveByTypePanel';
import { PendingWorkPanel } from '../shared/PendingWorkPanel';
import { useDashboardResource } from '../shared/useDashboardResource';
import { DashboardWidgets } from '../shared/DashboardWidgets';
import { useModuleDashboardWidgets } from '../shared/moduleDashboardWidgets';
import { userDashboardWidgets } from '../shared/userDashboardWidgets';
import { useBackupDashboardWidgets } from '@/features/backup-restore/dashboard/BackupDashboardWidgets';
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { tr, trFormat } from "@/i18n";

const dash = '—';

export function AdminDashboardView() {
  const navigate = useNavigate();
  const monitoringWidgets = useSystemMonitoringWidgets();
  const backupWidgets = useBackupDashboardWidgets();
  const moduleWidgets = useModuleDashboardWidgets();
  const summary = useDashboardResource(() => dashboardApi.getSummary(), []);
  const [taskQuery, setTaskQuery] = useState('');
  const taskSearch = useDebounce(taskQuery, SEARCH_DEBOUNCE_MS);
  const tasks = useDashboardResource(() => dashboardApi.getPendingWorkflowActions(taskSearch), [taskSearch]);
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

      <DashboardWidgets widgets={[
      { id: 'admin-total-users', label: tr('Total users'), width: 'half', content: <><KpiStrip label={tr("Total users")} className="!grid-cols-1" cells={[{ title: tr('Total users'), accent: '#10b981', value: st ? st.totalUsers : dash, chip: st ? trFormat("{rate}% active", { rate: activeRate }) : undefined, footValue: st ? st.activeUsers : dash, footLabel: tr("Active users") }]} />{stats.error && <PanelError message={tr("Administrative statistics could not be loaded.")} onRetry={stats.reload} />}</> },
      { id: 'admin-total-documents', label: tr('Total documents'), width: 'half', content: <><KpiStrip label={tr("Total documents")} className="!grid-cols-1" cells={[{ title: tr('Total documents'), accent: '#059669', value: st ? st.totalDocuments : dash, chip: st ? trFormat("{rate}% effective", { rate: share(effective, st.totalDocuments) }) : undefined, footValue: st ? effective : dash, footLabel: tr("Effective documents") }]} />{stats.error && <PanelError message={tr("Total documents could not be loaded.")} onRetry={stats.reload} />}</> },
      { id: 'admin-revisions-in-flight', label: tr('Revisions in flight'), width: 'half', content: <><KpiStrip label={tr("Revisions in flight")} className="!grid-cols-1" cells={[{ title: tr('Revisions in flight'), accent: '#34d399', value: st ? inFlight : dash, footValue: st ? revision('READY_FOR_PUBLISHING') : dash, footLabel: tr("Ready to publish") }]} />{stats.error && <PanelError message={tr("Revisions in flight could not be loaded.")} onRetry={stats.reload} />}</> },
      { id: 'admin-audit-events', label: tr('Audit events (30 days)'), width: 'half', content: <><KpiStrip label={tr("Audit events (30 days)")} className="!grid-cols-1" cells={[{ title: tr('Audit events (30 days)'), accent: '#6ee7b7', value: st ? st.auditEventsLast30Days : dash, footValue: st ? auditPeak.value : dash, footLabel: st ? `${tr("Peak day")} · ${auditPeak.label}` : tr("Peak day") }]} />{stats.error && <PanelError message={tr("Audit events (30 days) could not be loaded.")} onRetry={stats.reload} />}</> },

      { id: 'audit-activity', label: tr('Audit activity'), width: 'half', content: <Card aria-label={tr("Audit activity")} className="flex flex-col justify-between">
          <CardHeader title={tr("Audit activity")} subtitle={st ? trFormat("{count} events in the last 30 days, per UTC day", { count: st.auditEventsLast30Days.toLocaleString() }) : tr('Audit events per day')} />
          {st ? (
            auditSeries.some((point) => point.value > 0)
              ? <ActivityBarChart data={auditSeries} color="#10b981" valueLabel={tr("Audit events")} tickEvery={5} />
              : <p className="flex h-[232px] items-center justify-center text-sm text-slate-400">{tr("No audit events")}</p>
          ) : (
            <p className="flex h-[232px] items-center justify-center text-sm text-slate-400">{stats.loading ? tr("Loading…") : tr("Unavailable")}</p>
          )}
        </Card> },

      { id: 'revision-pipeline', label: tr('Revision pipeline'), width: 'half', content: <Card aria-label={tr("Revision pipeline")}>
          <CardHeader title={tr("Revision pipeline")} subtitle={st ? `${inPipeline.toLocaleString()} in review, approval or training · ${revision('READY_FOR_PUBLISHING').toLocaleString()} ready to publish` : tr('Revisions waiting in each stage')} />
          {st ? (
            <GrowthColumns
              columns={[
                { title: 'Review', value: revision('PENDING_REVIEW'), chip: `${share(revision('PENDING_REVIEW'), inPipeline)}%`, caption: 'Share of pipeline', pattern: 'hatch', tint: '#d1fae5' },
                { title: 'Approval', value: revision('PENDING_APPROVAL'), chip: `${share(revision('PENDING_APPROVAL'), inPipeline)}%`, caption: 'Share of pipeline', pattern: 'solid', tint: '#ccfbf1' },
                { title: 'Training', value: revision('PENDING_TRAINING'), chip: `${share(revision('PENDING_TRAINING'), inPipeline)}%`, caption: 'Share of pipeline', pattern: 'lines', tint: '#ecf3f0' },
              ]}
            />
          ) : (
            <p className="flex h-[250px] items-center justify-center text-sm text-slate-400">{stats.loading ? tr("Loading…") : tr("Unavailable")}</p>
          )}
        </Card> },

      { id: 'effective-by-type', label: tr('Effective documents by type'), width: 'half', content: <EffectiveByTypePanel /> },
      { id: 'documents-by-status', label: tr('Documents by status'), width: 'half', content: <DocumentsByStatusPanel stats={stats} /> },

      ...monitoringWidgets,

      // Library only: the cards about the administrator's own work, and the backup cards (which show for those who may view Backup & Restore).
      ...userDashboardWidgets(summary, true),
      ...backupWidgets,
      ...moduleWidgets,

      { id: 'pending-work', label: tr('Pending work'), width: 'full', content: <PendingWorkPanel
        query={taskQuery}
        onQueryChange={setTaskQuery}
        tasks={tasks}
        work={work}
        awaitingAction={awaitingAction}
        onOpenTask={(task) => navigate(`/documents/${task.documentId}/revisions/${task.revisionId}`)}
        onOpenAll={() => navigate('/documents/revisions')}
      /> },
      ]} />
    </div>
  );
}
