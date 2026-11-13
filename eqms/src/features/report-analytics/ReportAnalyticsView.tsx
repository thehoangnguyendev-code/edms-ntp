import React, { useMemo } from "react";
import { DataTable } from "@/components/ui/table";
import { Card, CardHeader, KpiStrip, type KpiCellData } from "@/features/self-service/dashboard/shared/dashboardUi";
import { ActivityBarChart } from "@/features/self-service/dashboard/shared/ActivityBarChart";
import { BRAND_PRIMARY_HEX } from "@/styles/tokens";
import { reportsApi, type AnalyticsDocumentControl, type AnalyticsTraining, type AnalyticsUsage } from "@/services/api/reports";
import { displayDate } from "@/utils/format";
import { usePermissions } from "@/hooks/usePermissions";
import { ReportAnalyticsPage } from "./ReportAnalyticsPage";
import { SectionBody } from "./SectionBody";
import { useSection } from "./useSection";

const EMERALD = "#10b981";
const BLUE = "#3b82f6";
const AMBER = "#f59e0b";
const VIOLET = "#8b5cf6";
const RED = "#ef4444";

/** A long name on the x axis is cut; the whole name is in the tooltip and in the table. */
const cut = (label: string, max = 10) => (label.length > max ? `${label.slice(0, max - 1)}…` : label);
const stageShort = (label: string) => label.replace(/^Pending /, "").replace("Ready for Publishing", "Publishing");

const n = (value: number | null | undefined) => (typeof value === "number" ? value : "—");
/** The first day of a week, in the one display format of dates of the application. */
const weekLabel = (weekStart: string) => displayDate(`${weekStart.slice(0, 10)}T00:00:00`);

/** Document Control: what is effective, in progress, due for review, and out as controlled copies. Needs the Document Control module permission. */
const DocumentControlSection: React.FC = () => {
  const { state, reload } = useSection<AnalyticsDocumentControl>(() => reportsApi.analyticsDocuments());
  const data = state.status === "ready" ? state.data : null;
  /** The chart shows the six types with most effective documents; the table below has them all. */
  const effectiveByType = useMemo(() => (data ? data.byType.filter((row) => row.effective > 0).slice(0, 6).map((row) => ({ label: row.type, value: row.effective })) : []), [data]);
  const stages = useMemo(() => data?.revisionsByStage ?? [], [data]);
  if (state.status === "denied") return null;
  const cells: KpiCellData[] = [
    { title: "Effective documents", accent: EMERALD, value: n(data?.effectiveDocuments), footValue: n(data?.revisedLast90Days), footLabel: "effective in last 90 days" },
    { title: "Revisions in progress", accent: BLUE, value: n(data?.revisionsInProgress), footValue: n(data?.revisionsWaitingOver14Days), footLabel: "waiting over 14 days" },
    { title: "Periodic reviews due", accent: AMBER, value: n(data?.reviewsDue), footValue: n(data?.reviewsOverdue), footLabel: "overdue" },
    { title: "Controlled copies out", accent: VIOLET, value: n(data?.controlledCopiesOut), footValue: n(data?.controlledCopiesExpired), footLabel: "past expiry" },
  ];
  return (
    <section aria-label="Document Control" className="flex flex-col gap-4 md:gap-6">
      <KpiStrip label="Document Control indicators" cells={cells} />
      {state.status === "loading" && <p role="status" className="text-sm text-slate-500">Loading…</p>}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          Document Control figures could not be loaded; they are not shown rather than shown wrong.{" "}
          <button type="button" className="font-medium underline" onClick={reload}>
            Retry
          </button>
        </p>
      )}
      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
            <Card aria-label="Effective documents by type" role="region">
              <CardHeader title="Effective documents by type" subtitle="Document Control, the six largest types" />
              {effectiveByType.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">No effective document.</p>
              ) : (
                <ActivityBarChart data={effectiveByType} color={BRAND_PRIMARY_HEX} valueLabel="Documents" showValues shortLabel={cut} titleFor={(label) => label} />
              )}
            </Card>
            <Card aria-label="Revisions in progress by stage" role="region">
              <CardHeader title="Revisions in progress by stage" subtitle="Revision workflow" />
              {stages.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">No revision in progress.</p>
              ) : (
                <ActivityBarChart data={stages} color={BRAND_PRIMARY_HEX} valueLabel="Revisions" showValues shortLabel={stageShort} titleFor={(label) => label} />
              )}
            </Card>
          </div>
          <Card aria-label="Table view" role="region">
            <CardHeader title="Table view" subtitle="The figures by document type, for reading and printing" />
            <div className="px-4 pb-4 pt-3">
              <DataTable
                rows={data.byType}
                getRowKey={(row) => row.type}
                columns={[
                  { id: "type", header: "Document type", cell: (row) => <span className="font-medium text-slate-900">{row.type}</span> },
                  { id: "effective", header: "Effective", cell: (row) => row.effective.toLocaleString() },
                  { id: "inRevision", header: "In revision", cell: (row) => row.inRevision.toLocaleString() },
                  { id: "reviewDue", header: "Review due", cell: (row) => row.reviewDue.toLocaleString() },
                ]}
              />
            </div>
          </Card>
        </>
      )}
    </section>
  );
};

/** Training: compliance of the department of the person (all departments with training.scope.all), activities that are late or due, and people who were absent. */
const TrainingSection: React.FC = () => {
  const { state, reload } = useSection<AnalyticsTraining>(() => reportsApi.analyticsTraining());
  const data = state.status === "ready" ? state.data : null;
  const series = useMemo(() => data?.activitiesByStatus ?? [], [data]);
  if (state.status === "denied") return null;
  if (data?.note === "NO_DEPARTMENT") {
    return (
      <Card aria-label="Training" role="region">
        <CardHeader title="Training" subtitle="Compliance and activities" />
        <p className="px-4 py-6 text-sm text-slate-500">Your account has no department, so there is no department of Training to count. Ask an administrator to set it.</p>
      </Card>
    );
  }
  const percent = data?.percentTrained;
  const cells: KpiCellData[] = [
    {
      title: "Trained on the matrix",
      accent: EMERALD,
      value: data ? (percent == null ? "—" : `${percent}%`) : "—",
      footValue: data ? `${(data.trained ?? 0).toLocaleString()} of ${(data.requirements ?? 0).toLocaleString()}` : "—",
      footLabel: "requirements met",
    },
    { title: "Not trained, or annual training due", accent: RED, value: data ? (data.notTrained ?? 0) + (data.annualDue ?? 0) : "—", footValue: n(data?.annualDue), footLabel: "annual training due" },
    { title: "Overdue training activities", accent: AMBER, value: n(data?.overdueActivities), footValue: n(data?.dueSoonActivities), footLabel: "due in the next 14 days" },
    { title: "Absent in open activities", accent: VIOLET, value: n(data?.absentInOpenActivities), footValue: n(data?.openActivities), footLabel: "open activities" },
  ];
  return (
    <section aria-label="Training" className="flex flex-col gap-4 md:gap-6">
      <KpiStrip label="Training indicators" cells={cells} />
      {state.status === "loading" && <p role="status" className="text-sm text-slate-500">Loading…</p>}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          Training figures could not be loaded; they are not shown rather than shown wrong.{" "}
          <button type="button" className="font-medium underline" onClick={reload}>
            Retry
          </button>
        </p>
      )}
      {data && (
        <Card aria-label="Training activities by status" role="region">
          <CardHeader title="Training activities by status" subtitle="Training Management" />
          {series.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">No training activity.</p> : <ActivityBarChart data={series} color={BRAND_PRIMARY_HEX} valueLabel="Activities" showValues shortLabel={stageShort} titleFor={(label) => label} />}
        </Card>
      )}
    </section>
  );
};

/** Use of the reports: runs per week and how many failed or were Full. */
const UsageSection: React.FC = () => {
  const { state, reload } = useSection<AnalyticsUsage>(() => reportsApi.analyticsUsage());
  const data = state.status === "ready" ? state.data : null;
  const series = useMemo(() => (data ? data.runsPerWeek.map((row) => ({ label: weekLabel(row.weekStart), value: row.value })) : []), [data]);
  return (
    <Card aria-label="Report runs per week" role="region">
      <CardHeader title="Report runs per week" subtitle={data?.allUsers ? "All users, last 6 weeks" : "Your runs, last 6 weeks"} />
      <SectionBody state={state} reload={reload}>
        {(usage) => (
          <>
            {series.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">No run in the last 6 weeks.</p> : <ActivityBarChart data={series} color={BRAND_PRIMARY_HEX} valueLabel="Runs" showValues />}
            <p className="px-4 pb-4 text-xs text-slate-500">
              Last 30 days: {usage.runsLast30Days.toLocaleString()} runs, {usage.failedLast30Days.toLocaleString()} failed, {usage.fullRunsLast30Days.toLocaleString()} run with Full.
            </p>
          </>
        )}
      </SectionBody>
    </Card>
  );
};

/** Quality Analytics: Document Control, Training and the use of the reports. Each section is read from the server on its own; a section the person has no permission for is left out. */
export const ReportAnalyticsView: React.FC = () => {
  // A section is asked for only by a person who may see it (the server decides again); the others are left out without a refused request.
  const { hasAnyPermission } = usePermissions();
  return (
    <ReportAnalyticsPage title="Quality Analytics">
      {hasAnyPermission(["documents.module.view"]) && <DocumentControlSection />}
      {hasAnyPermission(["training.compliance.view", "training.activity.view"]) && <TrainingSection />}
      <UsageSection />
    </ReportAnalyticsPage>
  );
};
