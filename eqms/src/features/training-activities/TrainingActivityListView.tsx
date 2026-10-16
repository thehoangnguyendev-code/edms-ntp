import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { IconInfoCircle, IconPlus, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { usePermissions } from "@/hooks/usePermissions";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingActivitiesApi, trainingError, type TrainingActivitySummary, type TrainingKind } from "@/services/api/trainingActivities";
import { KIND_LABEL, KIND_REASON_LABEL, STATUS_COLOR, STATUS_LABEL, day, trainingBreadcrumbs, TRAINING_PAGES } from "./trainingLabels";

const STATUSES = ["PLANNED", "NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION", "COMPLETED", "CANCELLED", "RESERVED"];
const CREATE_KINDS: TrainingKind[] = ["INITIAL", "PERIODIC", "UNPLANNED", "EXTERNAL"];

/** The training activities the person may see. Search, filters, sort and paging are applied by the server. */
export function TrainingActivityListView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canOrganize = hasPermission("training.activity.organize");
  const menu = usePortalDropdown();
  const drag = useTableDragScroll();
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [overdue, setOverdue] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ kind: "UNPLANNED", kindReason: "OTHER", externalType: "ACTIVE", title: "", dueDate: "", remarks: "" });
  const [busy, setBusy] = useState(false);

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
    { id: "title", header: "Title", sort: sorted("title"), cell: (r) => <div className="max-w-80 whitespace-normal">{r.title}</div> },
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

  const create = async () => {
    setBusy(true);
    try {
      const created = await trainingActivitiesApi.create({
        kind: form.kind as TrainingKind,
        kindReason: form.kindReason || undefined,
        externalType: form.kind === "EXTERNAL" ? form.externalType : undefined,
        title: form.title.trim(),
        dueDate: form.dueDate || undefined,
        remarks: form.remarks.trim() || undefined,
      });
      showToast({ type: "success", title: "Training activity created", message: created.trainingNumber });
      setCreating(false);
      navigate(`/training-management/activities/${created.id}`);
    } catch (e) {
      showToast({ type: "error", title: "The training activity was not created", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };

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
              <Button size="sm" variant="default" onClick={() => setCreating(true)}>
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
        searchPlaceholder="Search Training Number, title or document…"
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
      <PortalDropdownMenu isOpen={!!actionRow} onClose={menu.close} position={menu.position} minWidth={200}>
        {actionRow && (
          <div className="py-1">
            <DropdownMenuItem
              icon={<IconInfoCircle className="h-4 w-4" />}
              onClick={() => {
                navigate(`/training-management/activities/${actionRow.id}`);
                menu.close();
              }}
            >
              View Detail
            </DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>

      <FormModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onConfirm={() => void create()}
        title="New Training Activity"
        description="The Training Number is issued by the system when you create the activity. A training on a document is created from the document."
        confirmText="Create"
        isLoading={busy}
        confirmDisabled={!form.title.trim()}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Type" required>
            <Select value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} options={CREATE_KINDS.map((k) => ({ label: KIND_LABEL[k], value: k }))} enableSearch={false} />
          </FormField>
          <FormField label="Reason">
            <Select
              value={form.kindReason}
              onChange={(v) => setForm({ ...form, kindReason: v })}
              options={Object.entries(KIND_REASON_LABEL).map(([value, label]) => ({ label, value }))}
              enableSearch={false}
            />
          </FormField>
          {form.kind === "EXTERNAL" && (
            <FormField label="External training" required>
              <Select
                value={form.externalType}
                onChange={(v) => setForm({ ...form, externalType: v })}
                options={[{ label: "Our people go to another organisation", value: "ACTIVE" }, { label: "An outside person comes to us", value: "PASSIVE" }]}
                enableSearch={false}
              />
            </FormField>
          )}
          <div className="md:col-span-2">
            <FormField label="Title" required>
              <Input value={form.title} maxLength={255} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Due date">
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Remarks">
              <Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </FormField>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
