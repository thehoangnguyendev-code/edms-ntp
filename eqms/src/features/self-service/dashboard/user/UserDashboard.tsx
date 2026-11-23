import { tr } from "@/i18n";
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useDebounce } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardApi } from '@/services/api/dashboard';
import { useBackupDashboardWidgets } from '@/features/backup-restore/dashboard/BackupDashboardWidgets';
import { EffectiveByTypePanel } from '../shared/EffectiveByTypePanel';
import { PendingWorkPanel } from '../shared/PendingWorkPanel';
import { describeMyWork } from '../shared/dashboardMetrics';
import { useDashboardResource } from '../shared/useDashboardResource';
import { DashboardWidgets } from '../shared/DashboardWidgets';
import { useModuleDashboardWidgets } from '../shared/moduleDashboardWidgets';
import { userDashboardWidgets } from '../shared/userDashboardWidgets';
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function UserDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const backupWidgets = useBackupDashboardWidgets();
  const moduleWidgets = useModuleDashboardWidgets();
  const summary = useDashboardResource(() => dashboardApi.getSummary(), []);
  const [taskQuery, setTaskQuery] = useState('');
  const taskSearch = useDebounce(taskQuery, SEARCH_DEBOUNCE_MS);
  const tasks = useDashboardResource(() => dashboardApi.getPendingWorkflowActions(taskSearch), [taskSearch]);

  const s = summary.data;
  const work = s ? describeMyWork(s.myPendingTasks, tasks.data ?? []) : null;
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.username || 'User';
  const awaitingAction = s ? s.pendingReview + s.pendingApproval : undefined;

  return (
    <div className="w-full space-y-4">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">{greeting()}, {fullName}</h1>
        </div>
      </header>

      <DashboardWidgets widgets={[
      ...userDashboardWidgets(summary),
      { id: 'effective-by-type', label: tr('Effective documents by type'), width: 'half', content: <EffectiveByTypePanel /> },
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
