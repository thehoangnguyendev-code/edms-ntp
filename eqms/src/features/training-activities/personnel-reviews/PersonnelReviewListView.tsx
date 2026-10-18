import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconPlus } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingActivitiesApi, trainingError, trainingReviewsApi, type TrainingPersonnelReviewSummary, type TrainingReviewSuggestion } from "@/services/api/trainingActivities";
import { Input, Textarea } from "../shared/TrainingFields";
import { TrainingDateField } from "../shared/TrainingDateField";
import { day, trainingBreadcrumbs, TRAINING_PAGES } from "../shared/trainingLabels";

export const REVIEW_KIND_LABEL: Record<string, string> = { NEW_HIRE: "New employee", ABSENCE_RETURN: "Return after absence", DEPT_TRANSFER: "Transfer to another department", LOCATION_TRANSFER: "Transfer to another site" };
export const REVIEW_STATUS_LABEL: Record<string, string> = { OPEN: "Open", CLOSED: "Closed", CANCELLED: "Cancelled" };
export const REVIEW_STATUS_COLOR: Record<string, "amber" | "emerald" | "slate"> = { OPEN: "amber", CLOSED: "emerald", CANCELLED: "slate" };

/**
 * The reviews of the training of a person after an event that people handle by hand (SOP.0003 5.1 and 5.3.11). The system keeps the checklist, the links to the training
 * that was organised and the signature that closes it; it does not detect the event.
 */
export function PersonnelReviewListView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.job_assignment.manage");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ personId: "", kind: "NEW_HIRE", eventDate: "", absenceFrom: "", absenceTo: "", departmentFrom: "", departmentTo: "", note: "" });
  const [people, setPeople] = useState<{ label: string; value: string }[]>([]);
  const [suggestions, setSuggestions] = useState<TrainingReviewSuggestion[]>([]);
  useEffect(() => { if (canManage) trainingReviewsApi.suggestions().then(setSuggestions).catch(() => setSuggestions([])); }, [canManage]);
  // A new employee found in the user profiles opens the dialog already filled in.
  const startFor = (s: TrainingReviewSuggestion) => {
    setPeople([{ label: `${s.fullName}${s.employeeCode ? ` (${s.employeeCode})` : ""}`, value: s.id }]);
    setForm({ personId: s.id, kind: "NEW_HIRE", eventDate: s.startDate.slice(0, 10), absenceFrom: "", absenceTo: "", departmentFrom: "", departmentTo: "", note: "" });
    setCreating(true);
  };

  const searchPeople = useCallback(async (query: string) => {
    const list = await trainingActivitiesApi.people(query).catch(() => []);
    const mapped = list.map((p) => ({ label: `${p.fullName}${p.employeeCode ? ` (${p.employeeCode})` : ""}`, value: p.id }));
    setPeople(mapped);
    return mapped;
  }, []);
  const fetcher = useCallback((params: Record<string, string | number | boolean | undefined>) => trainingReviewsApi.list(params).catch((e) => { setError(trainingError(e)); throw e; }), []);
  const extra = useMemo(() => ({ status: status || undefined, kind: kind || undefined }), [status, kind]);
  const table = useServerTable<TrainingPersonnelReviewSummary>({ fetcher, defaultSortBy: "createdAt", defaultSortDirection: "desc", extraParams: extra, initialItemsPerPage: 10 });

  const columns: DataTableColumn<TrainingPersonnelReviewSummary>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "employee", header: "Employee", cell: (r) => <button type="button" className="text-left" onClick={() => navigate(`/training-management/personnel-reviews/${r.id}`)}><div className="font-medium text-emerald-600 hover:underline">{r.fullName}</div><div className="text-xs text-slate-500">{r.employeeCode ?? ""}</div></button> },
    { id: "kind", header: "Event", cell: (r) => REVIEW_KIND_LABEL[r.kind] ?? r.kind },
    { id: "date", header: "Event date", cell: (r) => day(r.eventDate) },
    { id: "department", header: "Department", cell: (r) => r.department ?? "—" },
    { id: "status", header: "Status", cell: (r) => <Badge color={REVIEW_STATUS_COLOR[r.status]}>{REVIEW_STATUS_LABEL[r.status]}</Badge> },
    { id: "open", header: "Items to do", cell: (r) => (r.status === "OPEN" ? r.openItems : "—") },
    { id: "by", header: "Opened by", cell: (r) => `${r.createdByName} (${day(r.createdAt)})` },
  ];
  const { layout, control } = useCustomColumnLayout("training.personnel.reviews", columns);
  const filters: ReportSelectFilter[] = [
    { id: "kind", label: "Event", value: kind, options: [{ label: "All events", value: "" }, ...Object.entries(REVIEW_KIND_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setKind(v); table.setCurrentPage(1); } },
    { id: "status", label: "Status", value: status, options: [{ label: "All statuses", value: "" }, ...Object.entries(REVIEW_STATUS_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setStatus(v); table.setCurrentPage(1); } },
  ];

  const transfer = form.kind === "DEPT_TRANSFER" || form.kind === "LOCATION_TRANSFER";
  const absence = form.kind === "ABSENCE_RETURN";
  const valid = form.personId && form.eventDate && (!absence || (form.absenceFrom && form.absenceTo));
  const create = async () => {
    setBusy(true);
    try {
      const created = await trainingReviewsApi.create({
        personUserId: form.personId, kind: form.kind, eventDate: form.eventDate, absenceFrom: absence ? form.absenceFrom : undefined, absenceTo: absence ? form.absenceTo : undefined,
        departmentFrom: transfer ? form.departmentFrom.trim() || undefined : undefined, departmentTo: transfer ? form.departmentTo.trim() || undefined : undefined, note: form.note.trim() || undefined,
      });
      showToast({ type: "success", title: "Review opened", message: created.fullName });
      setCreating(false);
      navigate(`/training-management/personnel-reviews/${created.id}`);
    } catch (e) {
      showToast({ type: "error", title: "The review was not opened", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title={TRAINING_PAGES.reviews.title} breadcrumbItems={trainingBreadcrumbs(navigate, "reviews")}
        actions={canManage ? <Button size="sm" onClick={() => { setForm({ personId: "", kind: "NEW_HIRE", eventDate: "", absenceFrom: "", absenceTo: "", departmentFrom: "", departmentTo: "", note: "" }); setCreating(true); void searchPeople(""); }}><IconPlus className="mr-2 h-4 w-4" />New Review</Button> : undefined} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {suggestions.length > 0 && (
        <section aria-label="New employees without a review" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">{suggestions.length} new employee{suggestions.length === 1 ? "" : "s"} started in the last 60 days and {suggestions.length === 1 ? "has" : "have"} no initial training review.</p>
          <p className="mt-1 text-xs text-amber-800">The start date comes from the user profile. This is a reminder, not a rule: open the review when it applies.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <li key={s.id}><Button size="sm" variant="outline" onClick={() => startFor(s)}>{s.fullName} · started {day(s.startDate)} · Open review</Button></li>
            ))}
          </ul>
        </section>
      )}
      <ReportListToolbar searchPlaceholder="Search employee…" search={table.searchQuery} onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters} dates={[]} hasActiveFilters={Boolean(status || kind)} onClear={() => { setStatus(""); setKind(""); table.setCurrentPage(1); }} customControl={control}>
        <DataTable rows={table.items} getRowKey={(r) => r.id} isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading…" />} columns={columns} columnLayout={layout}
          emptyState={<TableEmptyState title="No Reviews" description="Open a review when a new employee joins, a person returns after a long absence, or a person transfers." />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined} />
      </ReportListToolbar>
      <FormModal isOpen={creating} onClose={() => setCreating(false)} onConfirm={() => void create()} title="Open a training review" description="Use it when a new employee joins, a person returns after more than six months away, or a person transfers. You work through the checklist of the SOP, then close it with a signature."
        confirmText="Open review" isLoading={busy} confirmDisabled={!valid} size="md">
        <div className="grid gap-4">
          <FormField label="Employee" required><Select value={form.personId} onChange={(v) => setForm({ ...form, personId: v })} options={people} onSearch={searchPeople} placeholder="Search by name" /></FormField>
          <FormField label="Event" required><Select value={form.kind} enableSearch={false} onChange={(v) => setForm({ ...form, kind: v })} options={Object.entries(REVIEW_KIND_LABEL).map(([value, label]) => ({ label, value }))} /></FormField>
          <TrainingDateField label={absence ? "Return date" : transfer ? "Transfer date" : "Start date"} value={form.eventDate} onChange={(v) => setForm({ ...form, eventDate: v })} />
          {absence && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TrainingDateField label="Absent from" value={form.absenceFrom} onChange={(v) => setForm({ ...form, absenceFrom: v })} />
              <TrainingDateField label="Absent until" value={form.absenceTo} onChange={(v) => setForm({ ...form, absenceTo: v })} />
            </div>
          )}
          {transfer && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label={form.kind === "LOCATION_TRANSFER" ? "Previous site / department" : "Previous department"}><Input maxLength={120} value={form.departmentFrom} onChange={(e) => setForm({ ...form, departmentFrom: e.target.value })} /></FormField>
              <FormField label={form.kind === "LOCATION_TRANSFER" ? "New site / department" : "New department"}><Input maxLength={120} value={form.departmentTo} onChange={(e) => setForm({ ...form, departmentTo: e.target.value })} /></FormField>
            </div>
          )}
          <FormField label="Note"><Textarea rows={2} maxLength={1000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></FormField>
        </div>
      </FormModal>
    </div>
  );
}
