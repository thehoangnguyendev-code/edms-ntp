import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useDebounce } from '@/hooks';
import { Plus, Workflow } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentPermissions } from '@/features/documents/shared/useDocumentPermissions';
import { dashboardApi } from '@/services/api/dashboard';
import { EffectiveByTypePanel } from '../shared/EffectiveByTypePanel';
import { MyDocumentsPanel } from './MyDocumentsPanel';
import { PendingWorkPanel } from '../shared/PendingWorkPanel';
import { describeMyWork, share } from '../shared/dashboardMetrics';
import { PanelError } from '../shared/dashboardParts';
import { Card, CardHeader, GrowthColumns, KpiStrip, OutlineButton, PrimaryButton } from '../shared/dashboardUi';
import { DocumentActivityPanel } from './DocumentActivityPanel';
import { useDashboardResource } from '../shared/useDashboardResource';
import { DashboardWidgets } from '../shared/DashboardWidgets';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const dash = '—';

export function UserDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canCreateDocumentShell } = useDocumentPermissions();
  const summary = useDashboardResource(() => dashboardApi.getSummary(), []);
  const [taskQuery, setTaskQuery] = useState('');
  const taskSearch = useDebounce(taskQuery, 300);
  const tasks = useDashboardResource(() => dashboardApi.getPendingWorkflowActions(taskSearch), [taskSearch]);

  const s = summary.data;
  const work = s ? describeMyWork(s.myPendingTasks, tasks.data ?? []) : null;
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.username || 'User';

  const awaitingAction = s ? s.pendingReview + s.pendingApproval : undefined;
  const openItems = s ? s.pendingReview + s.pendingApproval + s.pendingTraining : 0;
  const effectiveShare = s ? share(s.totalEffectiveDocuments, s.totalDocuments) : undefined;
  const stage = (value: number | undefined, accent: string, title: string) => ({
    title,
    accent,
    value: value ?? dash,
    chip: value === undefined ? undefined : `${share(value, openItems)}% of open`,
    footValue: value === undefined ? dash : openItems,
    footLabel: 'Open workflow items',
  });

  return (
    <div className="w-full space-y-4">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">{greeting()}, {fullName}</h1>
        </div>
      </header>

      <DashboardWidgets widgets={[
      { id: 'user-kpis', label: 'Overview', width: 'full', content: <><KpiStrip
        label="Workflow and library totals"
        cells={[
          {
            title: 'My Pending Actions',
            accent: '#34d399',
            value: s ? s.myPendingTasks : dash,
            chip: s && awaitingAction ? `${share(s.myPendingTasks, awaitingAction)}% of awaiting` : undefined,
            footValue: s ? (awaitingAction ?? 0) : dash,
            footLabel: 'Awaiting review or approval',
          },
          stage(s?.pendingReview, '#10b981', 'Pending Review'),
          stage(s?.pendingApproval, '#059669', 'Pending Approval'),
          {
            title: 'Effective documents',
            accent: '#6ee7b7',
            value: s ? s.totalEffectiveDocuments : dash,
            chip: effectiveShare === undefined ? undefined : `${effectiveShare}% of all`,
            footValue: s ? s.totalDocuments : dash,
            footLabel: 'Total documents',
          },
        ]}
      />
      {summary.error && (
        <PanelError message="Totals could not be loaded." onRetry={summary.reload} />
      )}</> },

      { id: 'document-activity', label: 'Document activity', width: 'half', content: <DocumentActivityPanel /> },
      { id: 'workflow-pipeline', label: 'Workflow pipeline', width: 'half', content: <Card aria-label="Workflow pipeline">
          <CardHeader title="Workflow pipeline" subtitle={s ? `${openItems.toLocaleString()} revisions in review, approval or training` : 'Revisions waiting in each stage'} />
          {s ? (
            <GrowthColumns
              columns={[
                { title: 'Review', value: s.pendingReview, chip: `${share(s.pendingReview, openItems)}%`, caption: 'Share of open items', pattern: 'hatch', tint: '#d1fae5' },
                { title: 'Approval', value: s.pendingApproval, chip: `${share(s.pendingApproval, openItems)}%`, caption: 'Share of open items', pattern: 'solid', tint: '#ccfbf1' },
                { title: 'Training', value: s.pendingTraining, chip: `${share(s.pendingTraining, openItems)}%`, caption: 'Share of open items', pattern: 'lines', tint: '#ecf3f0' },
              ]}
            />
          ) : (
            <p className="flex h-[250px] items-center justify-center text-sm text-slate-400">{summary.loading ? 'Loading…' : 'Unavailable'}</p>
          )}
        </Card> },

      { id: 'my-documents', label: 'My documents', width: 'half', content: <MyDocumentsPanel /> },
      { id: 'effective-by-type', label: 'Effective documents by type', width: 'half', content: <EffectiveByTypePanel /> },

      { id: 'pending-work', label: 'Pending work', width: 'full', content: <PendingWorkPanel
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
