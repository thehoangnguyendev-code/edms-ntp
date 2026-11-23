import { MyDocumentsPanel } from '../user/MyDocumentsPanel';
import { DocumentActivityPanel } from '../user/DocumentActivityPanel';
import { share } from './dashboardMetrics';
import { PanelError } from './dashboardParts';
import { Card, CardHeader, GrowthColumns, KpiStrip } from './dashboardUi';
import type { DashboardResource } from './useDashboardResource';
import type { DashboardWidget } from './DashboardWidgets';
import type { DashboardSummary } from '@/services/api/dashboard';
import { tr } from "@/i18n";

const dash = '—';

/**
 * The cards about the signed-in person's own work. Every one reads data that any signed-in user may read, so they belong in
 * every dashboard's library; `inLibraryOnly` keeps them off a dashboard (an administrator's) until the person adds them.
 */
export function userDashboardWidgets(summary: DashboardResource<DashboardSummary>, inLibraryOnly = false): DashboardWidget[] {
  const s = summary.data;
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
  const error = (message: string) => summary.error && <PanelError message={message} onRetry={summary.reload} />;
  const defaultVisible = inLibraryOnly ? false : undefined;

  return [
    { id: 'user-pending-actions', label: tr('My pending actions'), width: 'half', defaultVisible, content: <><KpiStrip label={tr("My pending actions")} className="!grid-cols-1" cells={[{
          title: tr('My Pending Actions'),
          accent: '#34d399',
          value: s ? s.myPendingTasks : dash,
          chip: s && awaitingAction ? `${share(s.myPendingTasks, awaitingAction)}% of awaiting` : undefined,
          footValue: s ? (awaitingAction ?? 0) : dash,
          footLabel: 'Awaiting review or approval',
        }]} />{error('Totals could not be loaded.')}</> },
    { id: 'user-pending-review', label: tr('Pending review'), width: 'half', defaultVisible, content: <><KpiStrip label={tr("Pending review")} className="!grid-cols-1" cells={[stage(s?.pendingReview, '#10b981', 'Pending Review')]} />{error('Pending review could not be loaded.')}</> },
    { id: 'user-pending-approval', label: tr('Pending approval'), width: 'half', defaultVisible, content: <><KpiStrip label={tr("Pending approval")} className="!grid-cols-1" cells={[stage(s?.pendingApproval, '#059669', 'Pending Approval')]} />{error('Pending approval could not be loaded.')}</> },
    { id: 'user-effective-documents', label: tr('Effective documents'), width: 'half', defaultVisible, content: <><KpiStrip label={tr("Effective documents")} className="!grid-cols-1" cells={[{
          title: tr('Effective documents'),
          accent: '#6ee7b7',
          value: s ? s.totalEffectiveDocuments : dash,
          chip: effectiveShare === undefined ? undefined : `${effectiveShare}% of all`,
          footValue: s ? s.totalDocuments : dash,
          footLabel: 'Total documents',
        }]} />{error('Effective documents could not be loaded.')}</> },
    { id: 'user-pending-training', label: tr('Pending training'), width: 'half', defaultVisible, content: <><KpiStrip label={tr("Pending training")} className="!grid-cols-1" cells={[stage(s?.pendingTraining, '#14b8a6', 'Pending Training')]} />{error('Pending training could not be loaded.')}</> },

    { id: 'document-activity', label: tr('Document activity'), width: 'half', defaultVisible, content: <DocumentActivityPanel /> },
    { id: 'workflow-pipeline', label: tr('Workflow pipeline'), width: 'half', defaultVisible, content: <Card aria-label={tr("Workflow pipeline")}>
        <CardHeader title={tr("Workflow pipeline")} subtitle={s ? `${openItems.toLocaleString()} revisions in review, approval or training` : 'Revisions waiting in each stage'} />
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

    { id: 'my-documents', label: tr('My documents'), width: 'half', defaultVisible, content: <MyDocumentsPanel /> },
  ];
}
