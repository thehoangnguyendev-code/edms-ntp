import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge/Badge';
import type { DashboardPendingWorkflowAction } from '@/services/api/dashboard';
import { ageInDays, formatAge, share, type MyWork } from './dashboardMetrics';
import { PanelError, RowsSkeleton } from './dashboardParts';
import { Card, CardHeader, FlatTable, NameCell, SearchBox, ToolbarButton, type FlatColumn } from './dashboardUi';
import type { DashboardResource } from './useDashboardResource';

const TASK_LABEL: Record<DashboardPendingWorkflowAction['taskType'], { label: string; color: 'amber' | 'emerald' }> = {
  REVIEW: { label: 'Review', color: 'amber' },
  APPROVAL: { label: 'Approval', color: 'emerald' },
};

/** Only the codes the dashboard API is known to return are translated; anything else is shown as received. */
const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: 'Pending review',
  PENDING_APPROVAL: 'Pending approval',
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

const COLUMNS: FlatColumn<DashboardPendingWorkflowAction>[] = [
  { key: 'document', header: 'Document', render: (task) => <NameCell name={task.documentName} caption={`${task.documentNumber} · Revision ${task.revisionNumber}`} /> },
  { key: 'task', header: 'Task', className: 'w-28', render: (task) => <Badge color={TASK_LABEL[task.taskType].color} size="sm">{TASK_LABEL[task.taskType].label}</Badge> },
  { key: 'status', header: 'Status', className: 'w-40 whitespace-nowrap', render: (task) => STATUS_LABEL[task.status] ?? task.status },
  { key: 'created', header: 'Revision created', className: 'w-40 whitespace-nowrap', render: (task) => <span title={formatDate(task.createdAt)}>{formatAge(ageInDays(task.createdAt))}</span> },
];

interface PendingWorkPanelProps {
  tasks: DashboardResource<DashboardPendingWorkflowAction[]>;
  /** Authoritative count from the summary; null while it is unavailable. */
  work: MyWork | null;
  /** Revisions awaiting review or approval across the system, for the share line. */
  awaitingAction?: number;
  onOpenTask: (task: DashboardPendingWorkflowAction) => void;
  onOpenAll: () => void;
  className?: string;
}

/**
 * Work items waiting for the current user, each with the document it belongs to. The task list is
 * capped by the API, so the counts come from the summary and the table says when it shows a part.
 */
export const PendingWorkPanel: React.FC<PendingWorkPanelProps> = ({ tasks, work, awaitingAction, onOpenTask, onOpenAll, className }) => {
  const [query, setQuery] = useState('');
  const loaded = tasks.data ?? [];
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? loaded.filter((task) => `${task.documentName} ${task.documentNumber}`.toLowerCase().includes(needle)) : loaded;
  }, [loaded, query]);

  const subtitle = work
    ? awaitingAction !== undefined && awaitingAction > 0
      ? `${work.total.toLocaleString()} assigned to you · ${share(work.total, awaitingAction)}% of the ${awaitingAction.toLocaleString()} revisions awaiting review or approval`
      : `${work.total.toLocaleString()} assigned to you`
    : 'Documents waiting for your review or approval';

  return (
    <Card className={className} aria-label="Pending work">
      <CardHeader title="Pending work" subtitle={subtitle} />
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <SearchBox value={query} onChange={setQuery} placeholder="Search document…" label="Search pending work" />
        <ToolbarButton onClick={onOpenAll}>Open document revisions <ArrowRight className="h-3.5 w-3.5" /></ToolbarButton>
      </div>
      <div className="border-t border-slate-200">
        {tasks.loading && !tasks.data ? <RowsSkeleton /> : tasks.error ? (
          <PanelError message="Your pending work could not be loaded." onRetry={tasks.reload} />
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">{loaded.length === 0 ? 'Nothing is waiting for you' : 'No document matches your search'}</p>
        ) : (
          <FlatTable
            columns={COLUMNS}
            rows={rows}
            rowKey={(task) => task.revisionId}
            onRowClick={onOpenTask}
            rowLabel={(task) => `Open ${task.documentName}`}
            className="max-h-[420px] overflow-y-auto custom-scrollbar"
          />
        )}
      </div>
      {work && work.total > loaded.length && loaded.length > 0 && (
        <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">Showing {loaded.length} of {work.total.toLocaleString()} items.</p>
      )}
    </Card>
  );
};
