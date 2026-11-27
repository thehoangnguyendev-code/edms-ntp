import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconChecks, IconPlus, IconX } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { statusColor } from "@/components/ui/badge/statusColors";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingError, trainingPersonnelEventsApi, type TrainingPersonnelEvent } from "@/services/api/trainingActivities";
import { TrainingPersonName } from "../shared/TrainingPersonName";
import { useTrainingRowMenu } from "../shared/useTrainingRowMenu";
import { resettingDates } from "../shared/useListFilters";
import { day, statusChange } from "../shared/trainingLabels";
import type { NewReviewForm } from "./NewPersonnelReviewModal";
import { emptyReviewForm } from "./NewPersonnelReviewModal";
import { usePersonnelAlertsServerTable } from "./usePersonnelAlertsServerTable";
import { ROUTES } from "@/app/routes.constants";
import { tr, trFormat } from "@/i18n";

/** What each alert is and what the SOP asks for (SOP.0003 5.1, 5.3.8, 5.3.11). The colour of each kind is in the one table of statusColors. */
const KIND: Record<string, { label: string; hint: string }> = {
  NEW_HIRE: { label: "New employee", hint: "Initial training, specimen signature and job assignment (SOP.0003 5.1.1, 5.3.8, 5.3.9)." },
  ABSENCE_RETURN: { label: "Return after absence", hint: "Retraining after an absence of more than the months of the SOP (SOP.0003 5.1.1)." },
  DEPT_TRANSFER: { label: "Transfer to another department", hint: "The receiving head and an assigned employee review the record (SOP.0003 5.3.11)." },
  POSITION_CHANGE: { label: "Change of position", hint: "Check the Job Role and make a new job assignment (SOP.0003 5.3.8)." },
  START_DATE_MISSING: { label: "Start date missing", hint: "Enter the start date in the user profile so that the training of a new employee can start." },
};
const STATUS_LABEL: Record<string, string> = { OPEN: "Open", HANDLED: "Handled", DISMISSED: "Dismissed" };
const REVIEW_KIND: Record<string, string> = { NEW_HIRE: "NEW_HIRE", ABSENCE_RETURN: "ABSENCE_RETURN", DEPT_TRANSFER: "DEPT_TRANSFER" };

/**
 * The alerts of the system: the people who need a training review, with the next step in the Action menu. The system recognises the events; a person decides what to do.
 * It is listed like the Job Assignments: the filters, the search, the sort and the paging are done by the server; by default only the open alerts are shown.
 */
export function PersonnelAlertsTab({ canManage, onOpenReview, onCount }: { canManage: boolean; onOpenReview: (form: NewReviewForm, people: { label: string; value: string }[]) => void; onCount?: (open: number) => void }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const table = usePersonnelAlertsServerTable();
  const [dismissing, setDismissing] = useState<TrainingPersonnelEvent>();

  // The number of open alerts is shown on the tab; it is read again whenever the list is.
  useEffect(() => {
    trainingPersonnelEventsApi.count().then((n) => onCount?.(n)).catch(() => undefined);
  }, [table.alerts, onCount]);

  const start = (e: TrainingPersonnelEvent) => {
    if (e.kind === "POSITION_CHANGE") { navigate(`${ROUTES.TRAINING.JOB_ASSIGNMENT_NEW}?person=${e.personUserId}&name=${encodeURIComponent(e.fullName)}`); return; }
    const reviewKind = REVIEW_KIND[e.kind];
    if (!reviewKind) return;
    onOpenReview({ ...emptyReviewForm, personId: e.personUserId, kind: reviewKind, eventDate: e.eventDate?.slice(0, 10) ?? "", absenceFrom: e.absenceFrom?.slice(0, 10) ?? "", absenceTo: e.absenceTo?.slice(0, 10) ?? "", departmentTo: e.departmentTo ?? "" },
      [{ label: `${e.fullName}${e.employeeCode ? ` (${e.employeeCode})` : ""}`, value: e.personUserId }]);
  };
  const detail = (e: TrainingPersonnelEvent) => {
    if (e.kind === "ABSENCE_RETURN") return trFormat("Absent from {from} until {to}.", { from: day(e.absenceFrom), to: day(e.absenceTo) });
    if (e.kind === "DEPT_TRANSFER") return trFormat("From {from} to {to}.", { from: e.departmentFrom ?? "—", to: e.departmentTo ?? "—" });
    if (e.kind === "POSITION_CHANGE") return trFormat("From {from} to {to}.", { from: e.positionFrom ?? "—", to: e.positionTo ?? "—" });
    return "";
  };
  // One dialog: the signature asks for the reason, which stays on record with it.
  const dismiss = async (token: string, reason: string) => {
    if (!dismissing) return;
    try {
      await trainingPersonnelEventsApi.dismiss(dismissing.id, reason.trim(), token);
      showToast({ type: "success", title: tr("Alert dismissed"), message: dismissing.fullName });
      setDismissing(undefined); table.reload();
    } catch (error) {
      showToast({ type: "error", title: tr("The action was not done"), message: trainingError(error) });
    }
  };

  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });
  const columns: DataTableColumn<TrainingPersonnelEvent>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_e, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "employeeCode", header: tr("Employee ID"), sort: sorted("employeeCode"), cellClassName: "text-slate-700 whitespace-nowrap", cell: (e) => e.employeeCode ?? "-" },
    { id: "employee", header: "Full Name", sort: sorted("employee"), cell: (e) => <TrainingPersonName fullName={e.fullName} avatar={e.avatar} /> },
    { id: "kind", header: tr("Alert"), sort: sorted("kind"), cell: (e) => <Badge color={statusColor(e.kind)} size="sm">{tr(KIND[e.kind]?.label ?? e.kind)}</Badge> },
    { id: "department", header: "Department", sort: sorted("department"), cellClassName: "text-slate-700 whitespace-nowrap", cell: (e) => e.department ?? "-" },
    { id: "eventDate", header: tr("Event Date"), sort: sorted("eventDate"), cellClassName: "text-slate-600 whitespace-nowrap", cell: (e) => day(e.eventDate) },
    { id: "status", header: "Status", sort: sorted("status"), cell: (e) => <Badge color={statusColor(e.status)} size="sm">{tr(STATUS_LABEL[e.status] ?? e.status)}</Badge> },
    {
      id: "next", header: tr("What to do"),
      cell: (e) => { const text = [detail(e), KIND[e.kind] ? tr(KIND[e.kind].hint) : ""].filter(Boolean).join(" "); return <div className="w-56 truncate text-xs text-slate-600" title={text}>{text}</div>; },
    },
  ];
  // The Action menu holds what the alert leads to; the server says whether the person may act on it.
  const rowMenu = useTrainingRowMenu(table.alerts, (e) => (canManage && e.canAct && e.status === "OPEN" ? [
    ...(e.kind !== "START_DATE_MISSING" ? [{ label: e.kind === "POSITION_CHANGE" ? "Make a job assignment" : "Open review", icon: e.kind === "POSITION_CHANGE" ? <IconPlus className="h-4 w-4" /> : <IconChecks className="h-4 w-4" />, onClick: () => start(e) }] : []),
    { label: "Dismiss", icon: <IconX className="h-4 w-4" />, onClick: () => setDismissing(e) },
  ] : []));
  const { layout, control } = useCustomColumnLayout("training.personnel.alerts", columns, rowMenu.action);

  const filters: ReportSelectFilter[] = [
    { id: "kind", label: "Alert", value: table.kindFilter, options: [{ label: "All", value: "" }, ...Object.entries(KIND).map(([value, k]) => ({ label: k.label, value }))], onChange: table.setKindFilter },
    { id: "status", label: "Status", value: table.statusFilter, options: [{ label: "All", value: "" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ label, value }))], onChange: table.setStatusFilter },
    { id: "department", label: "Department", value: table.departmentFilter, options: [{ label: "All", value: "" }, ...table.departmentOptions], onChange: table.setDepartmentFilter },
  ];

  return (
    <>
      {table.error && <p role="alert" className="text-sm text-red-700">{table.error}</p>}
      <ReportListToolbar
        framed={false}
        searchPlaceholder={tr("Search employee…")}
        search={table.searchQuery}
        onSearch={table.setSearchQuery}
        filters={filters}
        dates={resettingDates([table.eventRange.filter], () => table.setCurrentPage(1))}
        hasActiveFilters={table.hasActiveFilters}
        onClear={table.clearFilters}
        customControl={control}
      >
        <DataTable
          rows={table.alerts}
          getRowKey={(e) => e.id}
          isLoading={table.isLoading}
          columns={columns}
          columnLayout={layout}
          action={rowMenu.action}
          emptyState={<TableEmptyState title={tr("No Alerts Found")} description={tr("The system raises an alert when a new employee joins, a person returns after a long absence, or a person moves.")} />}
          pagination={table.totalItems > 0 ? (
            <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage}
              onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />
          ) : undefined}
        />
      </ReportListToolbar>
      {rowMenu.node}
      <ESignatureModal isOpen={!!dismissing} onClose={() => setDismissing(undefined)} onConfirm={async (d: { signatureToken: string; reason?: string }) => dismiss(d.signatureToken, (d.reason ?? "").trim())} actionTitle="Dismiss the Training Alert" changes={statusChange("Open", "Dismissed")}
        meaningDisplayName="Training Alert Dismissed" meaningCode="TRAINING_PERSONNEL_EVENT_DISMISSED" targetDetails={{ code: dismissing?.employeeCode ?? "", title: dismissing?.fullName ?? "", revision: "" }} />
    </>
  );
}
