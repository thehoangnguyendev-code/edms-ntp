import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { IconChalkboardTeacher, IconCheck, IconChecklist, IconChecks, IconInfoCircle, IconPencilMinus, IconPlus, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { usePermissions } from "@/hooks/usePermissions";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingActivitiesApi, trainingError, type TrainingActivitySummary } from "@/services/api/trainingActivities";
import { KIND_LABEL, KIND_REASON_LABEL, STATUS_COLOR, STATUS_LABEL, day, trainingBreadcrumbs, TRAINING_PAGES } from "../shared/trainingLabels";

const STATUSES = ["PLANNED", "NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION", "COMPLETED", "CANCELLED", "RESERVED"];

/** The training activities the person may see. Search, filters, sort and paging are applied by the server. */

export function TrainingActivityListView() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canOrganize = hasPermission("training.activity.organize");
  const menu = usePortalDropdown();
  const drag = useTableDragScroll();
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [overdue, setOverdue] = useState("");
  const [error, setError] = useState("");

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingActivitiesApi.list(params).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extraParams = useMemo(() => ({ status, kind, overdue: overdue === "yes" ? true : undefined }), [status, kind, overdue]);
  const table = useServerTable<TrainingActivitySummary>({ fetcher, defaultSortBy: "createdAt", defaultSortDirection: "desc", extraParams, initialItemsPerPage: 10 });
  useEffect(() => setError(""), [table.items]);

  const reset = (apply: () => void) => {
    apply();
    table.setCurrentPage(1);
  };
  const filters: ReportSelectFilter[] = [
    { id: "status", label: "Status", value: status, options: [{ label: "All statuses", value: "" }, ...STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: s }))], onChange: (v) => reset(() => setStatus(v)) },
    { id: "kind", label: "Type", value: kind, options: [{ label: "All types", value: "" }, ...Object.entries(KIND_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => reset(() => setKind(v)) },
    { id: "overdue", label: "Due date", value: overdue, options: [{ label: "All", value: "" }, { label: "Overdue", value: "yes" }], onChange: (v) => reset(() => setOverdue(v)) },
  ];
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<TrainingActivitySummary>[] = [
    { id: "no", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    {
      id: "number",
      header: "Training Number",
      sort: sorted("trainingNumber"),
      cell: (r) => (
        <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/training-management/activities/${r.id}`)}>
          {r.trainingNumber}
        </button>
      ),
    },
    { id: "title", header: "Training Title", sort: sorted("trainingTitle"), cell: (r) => <div className="max-w-80 whitespace-normal">{r.trainingTitle}</div> },
    { id: "kind", header: "Type", sort: sorted("kind"), cell: (r) => KIND_LABEL[r.kind] ?? r.kind },
    { id: "reason", header: "Reason", cell: (r) => (r.kindReason ? KIND_REASON_LABEL[r.kindReason] ?? r.kindReason : "—") },
    { id: "status", header: "Status", sort: sorted("status"), cell: (r) => <Badge color={STATUS_COLOR[r.status] ?? "slate"}>{STATUS_LABEL[r.status] ?? r.status}</Badge> },
    { id: "document", header: "Document", cell: (r) => (r.documentNumber ? `${r.documentNumber}${r.revisionNumber ? ` Rev ${r.revisionNumber}` : ""}` : "—") },
    { id: "department", header: "Department", cell: (r) => r.departmentName },
    { id: "people", header: "People", cell: (r) => r.participantCount },
    { id: "due", header: "Due", sort: sorted("dueDate"), cell: (r) => day(r.dueDate) },
  ];
  const action = {
    cell: (r: TrainingActivitySummary) => (
      <button
        type="button"
        ref={menu.getRef(r.id)}
        aria-label="More actions"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
        onClick={(event) => menu.toggle(r.id, event)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };
  const { layout, control } = useCustomColumnLayout("training.activities.list", columns, action);
  const actionRow = table.items.find((row) => row.id === menu.openId);

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col gap-4 md:gap-6">
      <PageHeader
        title={TRAINING_PAGES.activities.title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "activities")}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => table.reload()}>
              <IconRefresh className={`mr-2 h-4 w-4 ${table.isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {canOrganize && (
              <Button size="sm" variant="default" onClick={() => navigate("/training-management/activities/new")}>
                <IconPlus className="mr-2 h-4 w-4" />
                New Training Activity
              </Button>
            )}
          </>
        }
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <ReportListToolbar
        searchPlaceholder="Search Training Number, Training Title or document…"
        search={table.searchQuery}
        onSearch={(value) => {
          table.setSearchQuery(value);
          table.setCurrentPage(1);
        }}
        filters={filters}
        dates={[]}
        hasActiveFilters={Boolean(status || kind || overdue)}
        onClear={() => {
          setStatus("");
          setKind("");
          setOverdue("");
          table.setCurrentPage(1);
        }}
        customControl={control}
      >
        <DataTable
          rows={table.items}
          getRowKey={(r) => r.id}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading training activities…" />}
          emptyState={<TableEmptyState title="No Training Activities Found" description="Training activities will appear here. Try changing your search or filters." />}
          scrollerRef={drag.scrollerRef}
          scrollProps={drag.dragEvents}
          isDragging={drag.isDragging}
          columns={columns}
          columnLayout={layout}
          action={action}
          pagination={
            table.totalItems > 0 ? (
              <TablePagination
                currentPage={table.currentPage}
                totalPages={table.totalPages}
                totalItems={table.totalItems}
                itemsPerPage={table.itemsPerPage}
                onPageChange={table.setCurrentPage}
                onItemsPerPageChange={table.setItemsPerPage}
              />
            ) : undefined
          }
        />
      </ReportListToolbar>
      <PortalDropdownMenu isOpen={!!actionRow} onClose={menu.close} position={menu.position} minWidth={240}>
        {actionRow && (
          <div className="py-1">
            {[
              { show: true, icon: <IconInfoCircle className="h-4 w-4" />, label: "View Details", to: `/training-management/activities/${actionRow.id}` },
              { show: actionRow.actions?.edit, icon: <IconPencilMinus className="h-4 w-4" />, label: "Edit Training Activity", to: `/training-management/activities/${actionRow.id}/edit` },
              { show: actionRow.actions?.conduct, icon: <IconChalkboardTeacher className="h-4 w-4" />, label: "Conduct Training", to: `/training-management/activities/${actionRow.id}/conduct` },
              { show: actionRow.actions?.review, icon: <IconCheck className="h-4 w-4" />, label: "Review Training Content", to: `/training-management/activities/${actionRow.id}/review` },
              { show: actionRow.actions?.approve, icon: <IconChecks className="h-4 w-4" />, label: "Approve Training Content", to: `/training-management/activities/${actionRow.id}/approve` },
              { show: actionRow.actions?.confirm, icon: <IconChecks className="h-4 w-4" />, label: "Confirm Training Completion", to: `/training-management/activities/${actionRow.id}/confirm` },
              { show: actionRow.actions?.completeTraining && actionRow.revisionId, icon: <IconChecklist className="h-4 w-4" />, label: "Complete Training (Revision)", to: `/documents/revisions/training/${actionRow.revisionId}` },
            ].filter((item) => item.show).map((item) => (
              <DropdownMenuItem key={item.label} icon={item.icon} onClick={() => { navigate(item.to); menu.close(); }}>
                {item.label}
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </PortalDropdownMenu>

    </div>
  );
}
