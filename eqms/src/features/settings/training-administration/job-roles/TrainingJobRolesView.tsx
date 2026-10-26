import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconEye, IconPencilMinus, IconPlus, IconToggleLeft, IconToggleRight } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { trainingAdministrationBase } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { usePermissions } from "@/hooks/usePermissions";
import { dictionaryApi } from "@/services/api/dictionary";
import { trainingError, trainingJobRoleApi, type TrainingJobRole } from "@/services/api/trainingActivities";
import { Input, Textarea } from "@/features/training-activities/shared/TrainingFields";
import { useTrainingRowMenu } from "@/features/training-activities/shared/useTrainingRowMenu";
import { useDepartmentOptions } from "@/features/training-activities/shared/useListFilters";

const STATUS_OPTIONS = [{ label: "All", value: "" }, { label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }];
interface Form { id?: string; version?: number; code: string; name: string; departmentId: string; titlePositionId: string; description: string; jurisdiction: string; active: boolean }
const EMPTY: Form = { code: "", name: "", departmentId: "", titlePositionId: "", description: "", jurisdiction: "", active: true };

/**
 * The Job Roles of Training (SOP.0003 5.2 and 5.3.8): the duties under a department ("QC - Microbiology"), each under the title (Position of the Dictionaries) that the people have.
 * The training matrix has one column for each Job Role, and a job assignment (APD.0024) gives a Job Role to a person after the training the matrix requires for it. The list is searched,
 * filtered, sorted and paged by the server.
 */
export function TrainingJobRolesView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.admin.manage");
  const departments = useDepartmentOptions();
  const [titles, setTitles] = useState<{ label: string; value: string }[]>([]);
  const [status, setStatus] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [titlePositionId, setTitlePositionId] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<Form>();
  const [viewing, setViewing] = useState<TrainingJobRole>();
  const [saving, setSaving] = useState(false);
  useEffect(() => { dictionaryApi.getPositions().then((list) => setTitles(list.map((p) => ({ label: p.name, value: p.id })))).catch(() => setTitles([])); }, []);

  const fetcher = useCallback((params: Record<string, string | number | boolean | undefined>) => trainingJobRoleApi.list(params).catch((e) => { setError(trainingError(e)); throw e; }), []);
  const extra = useMemo(() => ({ status: status || undefined, departmentId: departmentId || undefined, titlePositionId: titlePositionId || undefined }), [status, departmentId, titlePositionId]);
  const table = useServerTable<TrainingJobRole>({ persistKey: "training.job.roles", fetcher, defaultSortBy: "name", extraParams: extra, initialItemsPerPage: 10, syncToUrl: false });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });
  const reset = () => table.setCurrentPage(1);

  const edit = (r: TrainingJobRole) => setForm({ id: r.id, version: r.version, code: r.code, name: r.name, departmentId: r.departmentId, titlePositionId: r.titlePositionId ?? "", description: r.description ?? "", jurisdiction: r.jurisdiction ?? "", active: r.active });
  const rowMenu = useTrainingRowMenu(table.items, (r) => [
    { label: "View Details", icon: <IconEye className="h-4 w-4" />, onClick: () => setViewing(r) },
    ...(canManage ? [{ label: "Edit Job Role", icon: <IconPencilMinus className="h-4 w-4" />, onClick: () => edit(r) }] : []),
    ...(canManage && r.active ? [{ label: "Deactivate Job Role", icon: <IconToggleLeft className="h-4 w-4" />, onClick: () => void toggle(r, false) }] : []),
    ...(canManage && !r.active ? [{ label: "Activate Job Role", icon: <IconToggleRight className="h-4 w-4" />, onClick: () => void toggle(r, true) }] : []),
  ]);
  const toggle = async (r: TrainingJobRole, active: boolean) => {
    try {
      await trainingJobRoleApi.save(r.id, { name: r.name, titlePositionId: r.titlePositionId ?? null, description: r.description ?? undefined, jurisdiction: r.jurisdiction ?? undefined, active, version: r.version });
      showToast({ type: "success", title: active ? "Job Role activated" : "Job Role deactivated", message: r.name });
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The Job Role was not changed", message: trainingError(e) });
    }
  };
  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await trainingJobRoleApi.save(form.id ?? null, {
        code: form.id ? undefined : form.code.trim(), name: form.name.trim(), departmentId: form.id ? undefined : form.departmentId, titlePositionId: form.titlePositionId || null,
        description: form.description.trim(), jurisdiction: form.jurisdiction.trim(), active: form.active, version: form.version,
      });
      showToast({ type: "success", title: form.id ? "Job Role saved" : "Job Role created", message: form.name.trim() });
      setForm(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The Job Role was not saved", message: trainingError(e) });
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<TrainingJobRole>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "code", header: "Job Role Code", sort: sorted("code"), cell: (r) => r.code },
    { id: "name", header: "Job Role", sort: sorted("name"), cell: (r) => <div className="max-w-80 whitespace-normal font-medium text-slate-900">{r.name}</div> },
    { id: "department", header: "Department", sort: sorted("department"), cell: (r) => r.departmentName },
    { id: "title", header: "Position", sort: sorted("title"), cell: (r) => r.titlePositionName ?? "—" },
    { id: "holders", header: "People Holding It", cell: (r) => r.holders },
    { id: "topics", header: "Topics in the Effective Matrix", cell: (r) => r.effectiveTopics },
    { id: "status", header: "Status", sort: sorted("active"), cell: (r) => <Badge color={r.active ? "emerald" : "slate"}>{r.active ? "Active" : "Inactive"}</Badge> },
  ];
  const { layout, control } = useCustomColumnLayout("training.job.roles", columns, rowMenu.action);
  const filters: ReportSelectFilter[] = [
    { id: "status", label: "Status", value: status, options: STATUS_OPTIONS, onChange: (v) => { setStatus(v); reset(); } },
    { id: "department", label: "Department", value: departmentId, options: [{ label: "All", value: "" }, ...departments], onChange: (v) => { setDepartmentId(v); reset(); } },
    { id: "title", label: "Position", value: titlePositionId, options: [{ label: "All", value: "" }, ...titles], onChange: (v) => { setTitlePositionId(v); reset(); } },
  ];
  const valid = !!form && form.name.trim().length > 0 && (!!form.id || (form.code.trim().length > 0 && !!form.departmentId));
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title="Job Roles" breadcrumbItems={[...trainingAdministrationBase(navigate), { label: "Job Roles", isActive: true }]}
        actions={canManage ? <Button size="sm" onClick={() => setForm({ ...EMPTY })}><IconPlus className="mr-2 h-4 w-4" />New Job Role</Button> : undefined} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar searchPlaceholder="Search code, name, department or position…" search={table.searchQuery} onSearch={(v) => { table.setSearchQuery(v); reset(); }}
        filters={filters} dates={[]} hasActiveFilters={Boolean(status || departmentId || titlePositionId || table.searchQuery)}
        onClear={() => { setStatus(""); setDepartmentId(""); setTitlePositionId(""); table.setSearchQuery(""); reset(); }} customControl={control}>
        <DataTable rows={table.items} getRowKey={(r) => r.id} isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading Job Roles…" />} columns={columns} columnLayout={layout}
          emptyState={<TableEmptyState title="No Job Roles" description="Try changing your search or filter." />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined} />
      </ReportListToolbar>
      {rowMenu.node}

      <FormModal isOpen={!!form} onClose={() => setForm(undefined)} onConfirm={() => void save()} title={form?.id ? "Edit Job Role" : "New Job Role"} confirmText="Save" isLoading={saving} confirmDisabled={!valid} size="md"
        description="A Job Role is a duty under a department, for example QC - Microbiology. The code and the department cannot be changed after it is created.">
        {form && (
          <div className="grid gap-4">
            <FormField label="Job Role Code" required><Input value={form.code} maxLength={40} disabled={!!form.id} onChange={(e) => setForm({ ...form, code: e.target.value })} /></FormField>
            <FormField label="Job Role" required><Input value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
            <FormField label="Department" required><Select value={form.departmentId} disabled={!!form.id} onChange={(v) => setForm({ ...form, departmentId: v })} options={departments} placeholder="Choose" /></FormField>
            <FormField label="Position" hint="The title (from the Dictionaries) of the people who usually hold this Job Role."><Select value={form.titlePositionId} onChange={(v) => setForm({ ...form, titlePositionId: v })} options={[{ label: "None", value: "" }, ...titles]} placeholder="Choose" /></FormField>
            <FormField label="Description of the Working Position" hint="What the working position is."><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
            <FormField label="Jurisdiction" hint="The starting text of the jurisdiction in a new job assignment (APD.0024); it can be changed in the draft."><Textarea rows={3} value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></FormField>
          </div>
        )}
      </FormModal>

      <FormModal isOpen={!!viewing} onClose={() => setViewing(undefined)} onConfirm={() => setViewing(undefined)} title={viewing ? `${viewing.code}: ${viewing.name}` : "Job Role"} confirmText="Close" size="md">
        {viewing && (
          <dl className="grid gap-3 text-sm">
            <div><dt className="text-xs text-slate-500">Department</dt><dd>{viewing.departmentName}</dd></div>
            <div><dt className="text-xs text-slate-500">Position</dt><dd>{viewing.titlePositionName ?? "—"}</dd></div>
            <div><dt className="text-xs text-slate-500">Description of the Working Position</dt><dd className="whitespace-pre-wrap">{viewing.description || "—"}</dd></div>
            <div><dt className="text-xs text-slate-500">Jurisdiction</dt><dd className="whitespace-pre-wrap">{viewing.jurisdiction || "—"}</dd></div>
            <div><dt className="text-xs text-slate-500">People Holding It</dt><dd>{viewing.holders}</dd></div>
          </dl>
        )}
      </FormModal>
    </div>
  );
}
