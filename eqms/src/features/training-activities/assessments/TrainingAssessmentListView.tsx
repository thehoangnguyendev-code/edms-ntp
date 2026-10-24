import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconInfoCircle, IconPlus } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { usePermissions } from "@/hooks/usePermissions";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingAssessmentsApi, trainingError, type TrainingAssessmentSummary } from "@/services/api/trainingActivities";
import { day, trainingBreadcrumbs, TRAINING_PAGES } from "../shared/trainingLabels";
import { useTrainingRowMenu } from "../shared/useTrainingRowMenu";

export const ASSESSMENT_STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", PENDING_APPROVAL: "Pending Approval", EFFECTIVE: "Effective", SUPERSEDED: "Replaced" };
export const ASSESSMENT_STATUS_COLOR: Record<string, "blue" | "amber" | "emerald" | "slate"> = { DRAFT: "blue", PENDING_APPROVAL: "amber", EFFECTIVE: "emerald", SUPERSEDED: "slate" };
/** The two kinds, named as the form APD.0009 does: the test of questions is the default of the SOP. */
export const ASSESSMENT_KIND_LABEL: Record<string, string> = { QUESTIONS: "Essay or multiple-choice test (APD.0009) (SOP default)", CHECKLIST: "Checklist test (APD.0009)" };

/** The library of Training Assessments (APD.0009): the tests and checklists a training activity can use. */
export function TrainingAssessmentListView() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canDesign = hasPermission("training.assessment.design");
  const [status, setStatus] = usePersistedState("training.assessments.status", "");
  const [kind, setKind] = usePersistedState("training.assessments.kind", "");
  const [error, setError] = useState("");

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingAssessmentsApi.list(params).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extra = useMemo(() => ({ status: status || undefined, kind: kind || undefined }), [status, kind]);
  const table = useServerTable<TrainingAssessmentSummary>({
    persistKey: "training.assessments",
    liveTypes: ["TRAINING"],
    fetcher,
    defaultSortBy: "updatedAt",
    defaultSortDirection: "desc",
    extraParams: extra,
    initialItemsPerPage: 10,
  });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const open = (id: string) => navigate(`/training-management/assessments/${id}`);
  const columns: DataTableColumn<TrainingAssessmentSummary>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "code", header: "Code", sort: sorted("code"), cell: (r) => <button type="button" className="font-medium text-emerald-700 hover:underline" onClick={() => open(r.id)}>{r.code} v{r.versionNo}</button> },
    { id: "title", header: "Title", sort: sorted("title"), cell: (r) => <div className="max-w-80 whitespace-normal">{r.title}</div> },
    { id: "kind", header: "Type", sort: sorted("kind"), cell: (r) => <div className="max-w-64 whitespace-normal">{ASSESSMENT_KIND_LABEL[r.kind] ?? r.kind}</div> },
    { id: "items", header: "Items", sort: sorted("itemCount"), cell: (r) => r.itemCount },
    { id: "max", header: "Total Score", sort: sorted("maxScore"), cell: (r) => (r.kind === "CHECKLIST" || r.maxScore == null ? "—" : r.maxScore) },
    { id: "status", header: "Status", sort: sorted("status"), cell: (r) => <Badge color={ASSESSMENT_STATUS_COLOR[r.status]}>{ASSESSMENT_STATUS_LABEL[r.status] ?? r.status}</Badge> },
    { id: "updatedBy", header: "Last Changed By", cell: (r) => r.updatedByName },
    { id: "updatedAt", header: "Last Changed On", sort: sorted("updatedAt"), cell: (r) => day(r.updatedAt) },
  ];
  const rowMenu = useTrainingRowMenu(table.items, (r) => [{ label: r.status === "DRAFT" ? "Continue Draft" : "View Details", icon: <IconInfoCircle className="h-4 w-4" />, onClick: () => open(r.id) }]);
  const { layout, control } = useCustomColumnLayout("training.assessments", columns, rowMenu.action);
  const filters: ReportSelectFilter[] = [
    {
      id: "status",
      label: "Status",
      value: status,
      options: [{ label: "All", value: "" }, ...Object.entries(ASSESSMENT_STATUS_LABEL).map(([value, label]) => ({ label, value }))],
      onChange: (v) => { setStatus(v); table.setCurrentPage(1); },
    },
    {
      id: "kind",
      label: "Type",
      value: kind,
      options: [{ label: "All", value: "" }, ...Object.entries(ASSESSMENT_KIND_LABEL).map(([value, label]) => ({ label, value }))],
      onChange: (v) => { setKind(v); table.setCurrentPage(1); },
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader
        title={TRAINING_PAGES.assessments.title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "assessments")}
        actions={canDesign ? <Button size="sm" onClick={() => navigate("/training-management/assessments/new")}><IconPlus className="mr-2 h-4 w-4" />New Assessment</Button> : undefined}
      />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder="Search code or title…"
        search={table.searchQuery}
        onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters}
        hasActiveFilters={Boolean(status || kind || table.searchQuery)}
        onClear={() => { setStatus(""); setKind(""); table.setCurrentPage(1); }}
        customControl={control}
      >
        <DataTable
          rows={table.items}
          getRowKey={(r) => r.id}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading…" />}
          columns={columns}
          columnLayout={layout}
          action={rowMenu.action}
          emptyState={<TableEmptyState title="No Training Assessments" description="The tests and checklists that training activities use appear here." />}
          pagination={
            table.totalItems > 0 ? (
              <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />
            ) : undefined
          }
        />
      </ReportListToolbar>
      {rowMenu.node}
    </div>
  );
}
