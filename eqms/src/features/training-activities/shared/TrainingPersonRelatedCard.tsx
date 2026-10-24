import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { usePermissions } from "@/hooks/usePermissions";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import {
  trainingJobsApi, trainingRecordsApi, trainingReviewsApi, trainingSpecimenApi,
  type TrainingJobSummary, type TrainingPage, type TrainingPersonnelReviewSummary, type TrainingRecord, type TrainingSpecimen,
} from "@/services/api/trainingActivities";
import { JOB_STATUS_COLOR, JOB_STATUS_LABEL } from "../jobs/TrainingJobListView";
import { REVIEW_KIND_LABEL, REVIEW_STATUS_COLOR, REVIEW_STATUS_LABEL } from "../personnel-reviews/personnelReviewLabels";
import { METHOD_LABEL, day, when } from "./trainingLabels";

type Kind = string;
/** A tab of the screen itself (the copies sent to departments of a job assignment) that sits first in the same card. */
export interface ExtraRelatedTab { id: string; label: string; node: ReactNode }
const SPECIMEN_LABEL: Record<string, string> = { PENDING: "Pending Confirmation", APPROVED: "Approved", SUPERSEDED: "Replaced", REJECTED: "Rejected" };
const RESULT_LABEL: Record<string, string> = { PASSED: "Passed", READ: "Read and understood", ATTENDED: "Attended" };

/** A small server table of what the training module holds about one person: 10 rows a page, newest first. `current` is the kind of the screen the card sits on. */
function RelatedTable<T extends { id: string }>({ persistKey, personId, fetcher, columns, empty, defaultSortBy }: {
  persistKey: string; personId: string; defaultSortBy: string; empty: string;
  fetcher: (params: Record<string, string | number | boolean | undefined>) => Promise<TrainingPage<T>>;
  columns: (offset: number) => DataTableColumn<T>[];
}) {
  const extraParams = useMemo(() => ({ personId }), [personId]);
  const table = useServerTable<T>({ persistKey, liveTypes: ["TRAINING"], fetcher, defaultSortBy, defaultSortDirection: "desc", extraParams, initialItemsPerPage: 10, syncToUrl: false });
  return (
    <DataTable
      rows={table.items} getRowKey={(r) => r.id} isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading…" />}
      columns={columns((table.currentPage - 1) * table.itemsPerPage)}
      emptyState={<TableEmptyState title={empty} description="" />}
      pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined}
    />
  );
}

/**
 * What the training module holds about the same person, under the footer buttons of a detail screen, as the sub-tabs of Document Details do: the personal training
 * records, the job assignments, the training reviews and the specimen signatures. Each tab is shown only to a person who may open that screen, and the server
 * applies the same scope as on the list; every row opens its own record.
 */
export function TrainingPersonRelatedCard({ personId, extraTabs = [] }: { personId: string; extraTabs?: ExtraRelatedTab[] }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const tabs: (TabItem & { id: Kind })[] = [
    ...extraTabs.map((t) => ({ id: t.id, label: t.label })),
    ...(hasPermission("training.record.view") ? [{ id: "records" as const, label: "Training Records" }] : []),
    ...(hasPermission("training.job_assignment.view") ? [{ id: "jobs" as const, label: "Job Assignments" }, { id: "reviews" as const, label: "Training Reviews" }] : []),
    ...(hasPermission("training.signature.view") || hasPermission("training.signature.manage") ? [{ id: "specimens" as const, label: "Specimen Signatures" }] : []),
  ];
  const [chosen, setChosen] = useState<Kind>();
  if (tabs.length === 0) return null;
  const active = tabs.some((t) => t.id === chosen) ? (chosen as Kind) : tabs[0].id;
  const extra = extraTabs.find((t) => t.id === active);
  const link = (text: string, to: string) => <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(to)}>{text}</button>;
  const no = (offset: number) => ({ id: "rowNo", header: "No.", locked: true, cell: (_r: unknown, i: number) => offset + i + 1 });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <TabNav tabs={tabs} activeTab={active} onChange={(id) => setChosen(id as Kind)} variant="simple-underline" />
      <div className="p-4 md:p-5">
        {extra?.node}
        {active === "records" && (
          <RelatedTable<TrainingRecord> persistKey="training.related.records" personId={personId} fetcher={trainingRecordsApi.list} defaultSortBy="completedOn" empty="No training record"
            columns={(offset) => [
              no(offset),
              { id: "number", header: "Training Number", cell: (r) => link(r.trainingNumber, `/training-management/activities/${r.activityId}`) },
              { id: "topic", header: "Training", cell: (r) => <div className="max-w-80 whitespace-normal">{r.topicText}</div> },
              { id: "method", header: "Mode", cell: (r) => METHOD_LABEL[r.method] ?? r.method },
              { id: "result", header: "Result", cell: (r) => (r.voidedAt ? <Badge color="red">Voided</Badge> : (RESULT_LABEL[r.result] ?? r.result)) },
              { id: "on", header: "Completed On", cell: (r) => day(r.completedOn) },
            ]} />
        )}
        {active === "jobs" && (
          <RelatedTable<TrainingJobSummary> persistKey="training.related.jobs" personId={personId} fetcher={trainingJobsApi.list} defaultSortBy="createdAt" empty="No job assignment"
            columns={(offset) => [
              no(offset),
              { id: "issue", header: "Issue", cell: (j) => link(`Issue ${j.issueNo}`, `/training-management/job-assignments/${j.id}`) },
              { id: "position", header: "Position", cell: (j) => j.positionName },
              { id: "type", header: "Type", cell: (j) => (j.caseType === "INITIAL" ? "Initial" : "Change") },
              { id: "status", header: "Status", cell: (j) => <Badge color={JOB_STATUS_COLOR[j.status]}>{JOB_STATUS_LABEL[j.status]}</Badge> },
              { id: "effective", header: "Effective", cell: (j) => day(j.effectiveAt) },
            ]} />
        )}
        {active === "reviews" && (
          <RelatedTable<TrainingPersonnelReviewSummary> persistKey="training.related.reviews" personId={personId} fetcher={trainingReviewsApi.list} defaultSortBy="createdAt" empty="No training review"
            columns={(offset) => [
              no(offset),
              { id: "no", header: "Review", cell: (r) => link(`Review ${r.reviewNo}`, `/training-management/personnel-reviews/${r.id}`) },
              { id: "kind", header: "Event", cell: (r) => REVIEW_KIND_LABEL[r.kind] ?? r.kind },
              { id: "status", header: "Status", cell: (r) => <Badge color={REVIEW_STATUS_COLOR[r.status]}>{REVIEW_STATUS_LABEL[r.status]}</Badge> },
              { id: "open", header: "Open Items", cell: (r) => r.openItems },
              { id: "created", header: "Created Time", cell: (r) => when(r.createdAt) },
            ]} />
        )}
        {active === "specimens" && (
          <RelatedTable<TrainingSpecimen> persistKey="training.related.specimens" personId={personId} fetcher={trainingSpecimenApi.list} defaultSortBy="createdAt" empty="No specimen signature"
            columns={(offset) => [
              no(offset),
              { id: "version", header: "Version", cell: (s) => link(`Version ${s.versionNo}`, `/training-management/specimen-signatures?search=${encodeURIComponent(s.employeeCode ?? s.fullName)}`) },
              { id: "status", header: "Status", cell: (s) => SPECIMEN_LABEL[s.status] ?? s.status },
              { id: "effective", header: "Effective", cell: (s) => day(s.effectiveDate) },
              { id: "uploaded", header: "Uploaded By", cell: (s) => s.uploadedByName },
              { id: "confirmed", header: "Confirmed By", cell: (s) => s.confirmedByName ?? "—" },
            ]} />
        )}
      </div>
    </div>
  );
}
