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
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
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

import { TableMarkup } from "@/components/ui/table/TablePrimitives";
const STATUS_OPTIONS = [{ label: "All", value: "" }, { label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }];
interface Form { id?: string; version?: number; code: string; name: string; departmentId: string; titlePositionId: string; description: string; jurisdiction: string; active: boolean; seniorManagement: boolean }
const EMPTY: Form = { code: "", name: "", departmentId: "", titlePositionId: "", description: "", jurisdiction: "", active: true, seniorManagement: false };

/**
 * The Work Positions of Training (SOP.0003 5.2 and 5.3.8): the duties under a department ("QC - Microbiology"), each under the title (Position of the Dictionaries) that the people have.
 * The training matrix has one column for each Work Position, and a job assignment (APD.0024) gives a Work Position to a person after the training the matrix requires for it. The list is searched,
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
  const [needs, setNeeds] = useState<Awaited<ReturnType<typeof trainingJobRoleApi.requirements>>>();
  useEffect(() => {
    setNeeds(undefined);
    if (viewing) trainingJobRoleApi.requirements(viewing.id).then(setNeeds).catch(() => setNeeds({ items: [] }));
  }, [viewing]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { dictionaryApi.getPositions().then((list) => setTitles(list.map((p) => ({ label: p.name, value: p.id })))).catch(() => setTitles([])); }, []);

  const fetcher = useCallback((params: Record<string, string | number | boolean | undefined>) => trainingJobRoleApi.list(params).catch((e) => { setError(trainingError(e)); throw e; }), []);
  const extra = useMemo(() => ({ status: status || undefined, departmentId: departmentId || undefined, titlePositionId: titlePositionId || undefined }), [status, departmentId, titlePositionId]);
  const table = useServerTable<TrainingJobRole>({ persistKey: "training.job.roles", fetcher, defaultSortBy: "name", extraParams: extra, initialItemsPerPage: 10, syncToUrl: false });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });
  const reset = () => table.setCurrentPage(1);

  const edit = (r: TrainingJobRole) => setForm({ id: r.id, version: r.version, code: r.code, name: r.name, departmentId: r.departmentId, titlePositionId: r.titlePositionId ?? "", description: r.description ?? "", jurisdiction: r.jurisdiction ?? "", active: r.active, seniorManagement: Boolean(r.seniorManagement) });
  const rowMenu = useTrainingRowMenu(table.items, (r) => [
    { label: "View Details", icon: <IconEye className="h-4 w-4" />, onClick: () => setViewing(r) },
    ...(canManage ? [{ label: "Edit Work Position", icon: <IconPencilMinus className="h-4 w-4" />, onClick: () => edit(r) }] : []),
    ...(canManage && r.active ? [{ label: "Deactivate Work Position", icon: <IconToggleLeft className="h-4 w-4" />, onClick: () => void toggle(r, false) }] : []),
    ...(canManage && !r.active ? [{ label: "Activate Work Position", icon: <IconToggleRight className="h-4 w-4" />, onClick: () => void toggle(r, true) }] : []),
  ]);
  const toggle = async (r: TrainingJobRole, active: boolean) => {
    try {
      await trainingJobRoleApi.save(r.id, { name: r.name, titlePositionId: r.titlePositionId ?? null, description: r.description ?? undefined, jurisdiction: r.jurisdiction ?? undefined, active, version: r.version });
      showToast({ type: "success", title: active ? "Work Position activated" : "Work Position deactivated", message: r.name });
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The Work Position was not changed", message: trainingError(e) });
    }
  };
  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await trainingJobRoleApi.save(form.id ?? null, {
        code: form.id ? undefined : form.code.trim(), name: form.name.trim(), departmentId: form.id ? undefined : form.departmentId, titlePositionId: form.titlePositionId || null,
        description: form.description.trim(), jurisdiction: form.jurisdiction.trim(), active: form.active, version: form.version, seniorManagement: form.seniorManagement,
      });
      showToast({ type: "success", title: form.id ? "Work Position saved" : "Work Position created", message: form.name.trim() });
      setForm(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The Work Position was not saved", message: trainingError(e) });
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<TrainingJobRole>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "code", header: "Work Position Code", sort: sorted("code"), cell: (r) => r.code },
    { id: "name", header: "Work Position", sort: sorted("name"), cell: (r) => <div className="max-w-80 whitespace-normal font-medium text-slate-900">{r.name}</div> },
    { id: "department", header: "Department", sort: sorted("department"), cell: (r) => r.departmentName },
    { id: "title", header: "Job Title", sort: sorted("title"), cell: (r) => r.titlePositionName ?? "—" },
    { id: "holders", header: "People Holding It", cell: (r) => r.holders },
    { id: "topics", header: "Training Topics in the Effective Matrix", cell: (r) => r.effectiveTopics },
    { id: "status", header: "Status", sort: sorted("active"), cell: (r) => <Badge color={r.active ? "emerald" : "slate"}>{r.active ? "Active" : "Inactive"}</Badge> },
  ];
  const { layout, control } = useCustomColumnLayout("training.job.roles", columns, rowMenu.action);
  const filters: ReportSelectFilter[] = [
    { id: "status", label: "Status", value: status, options: STATUS_OPTIONS, onChange: (v) => { setStatus(v); reset(); } },
    { id: "department", label: "Department", value: departmentId, options: [{ label: "All", value: "" }, ...departments], onChange: (v) => { setDepartmentId(v); reset(); } },
    { id: "title", label: "Job Title", value: titlePositionId, options: [{ label: "All", value: "" }, ...titles], onChange: (v) => { setTitlePositionId(v); reset(); } },
  ];
  const valid = !!form && form.name.trim().length > 0 && (!!form.id || (form.code.trim().length > 0 && !!form.departmentId));
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title="Work Positions" breadcrumbItems={[...trainingAdministrationBase(navigate), { label: "Work Positions", isActive: true }]}
        actions={canManage ? <Button size="sm" onClick={() => setForm({ ...EMPTY })}><IconPlus className="mr-2 h-4 w-4" />New Work Position</Button> : undefined} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar searchPlaceholder="Search code, name, department or job title…" search={table.searchQuery} onSearch={(v) => { table.setSearchQuery(v); reset(); }}
        filters={filters} dates={[]} hasActiveFilters={Boolean(status || departmentId || titlePositionId || table.searchQuery)}
        onClear={() => { setStatus(""); setDepartmentId(""); setTitlePositionId(""); table.setSearchQuery(""); reset(); }} customControl={control}>
        <DataTable rows={table.items} getRowKey={(r) => r.id} isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading Work Positions…" />} columns={columns} columnLayout={layout} action={rowMenu.action}
          emptyState={<TableEmptyState title="No Work Positions" description="Try changing your search or filter." />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined} />
      </ReportListToolbar>
      {rowMenu.node}

      <FormModal isOpen={!!form} onClose={() => setForm(undefined)} onConfirm={() => void save()} title={form?.id ? "Edit Work Position" : "New Work Position"} confirmText="Save" isLoading={saving} confirmDisabled={!valid} size="2xl"
        description="A Work Position is a duty under a department, for example QC - Microbiology. The code and the department cannot be changed after it is created.">
        {form && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Work Position Code" required><Input value={form.code} maxLength={40} disabled={!!form.id} onChange={(e) => setForm({ ...form, code: e.target.value })} /></FormField>
            <FormField label="Work Position" required><Input value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
            <FormField label="Department" required><Select value={form.departmentId} disabled={!!form.id} onChange={(v) => setForm({ ...form, departmentId: v })} options={departments} placeholder="Choose" /></FormField>
            <FormField label="Job Title" hint="The title (from the Dictionaries) of the people who usually hold this Work Position."><Select value={form.titlePositionId} onChange={(v) => setForm({ ...form, titlePositionId: v })} options={[{ label: "None", value: "" }, ...titles]} placeholder="Choose" /></FormField>
            <FormField label="Description of the Work Position" hint="What the Work Position is."><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
            <FormField label="Senior management" hint="SOP.0003 5.3.1: the matrix of a senior management position (for example quality management or production management) is built by QA; the head of department cannot change its column.">
              <Checkbox checked={form.seniorManagement} onChange={(c) => setForm({ ...form, seniorManagement: c })} label="A senior management position" />
            </FormField>
            <FormField label="Jurisdiction" hint="The starting text of the jurisdiction in a new job assignment (APD.0024); it can be changed in the draft."><Textarea rows={3} value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></FormField>
          </div>
        )}
      </FormModal>

      <FormModal isOpen={!!viewing} onClose={() => setViewing(undefined)} onConfirm={() => setViewing(undefined)} title="Work Position Details" confirmText="Close" size="xl">
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{viewing.code}</p>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
              </div>
              <Badge color={viewing.active ? "emerald" : "slate"}>{viewing.active ? "Active" : "Inactive"}</Badge>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-4">
              {[["Department", viewing.departmentName], ["Job Title", viewing.titlePositionName ?? "—"], ["People Holding It", String(viewing.holders)], ["Training Topics in the Effective Matrix", String(viewing.effectiveTopics)], ...(viewing.seniorManagement ? [["Matrix built by", "QA (senior management)"]] : [])].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-900">Description of the Work Position</h4>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{viewing.description || "—"}</p>
              </section>
              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-900">Jurisdiction</h4>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{viewing.jurisdiction || "—"}</p>
              </section>
            </div>

            <section className="rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Training required before the Work Position is given</h4>
                  <p className="text-xs text-slate-500">{needs?.matrixCode ? `From the effective training matrix ${needs.matrixCode}, version ${needs.versionNo}.` : "From the effective training matrix of the department."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {needs?.effectiveVersionId && <Button size="sm" variant="outline-emerald" onClick={() => navigate(`/training-management/matrix/${needs.effectiveVersionId}`)}>Open the Effective Matrix</Button>}
                  {needs?.draftVersionId && <Button size="sm" variant="outline-emerald" onClick={() => navigate(`/training-management/matrix/${needs.draftVersionId}`)}>Open the Version in Preparation</Button>}
                </div>
              </div>
              {!needs ? (
                <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
              ) : !needs.effectiveVersionId ? (
                <p className="px-4 py-6 text-sm text-amber-700">The department has no effective matrix.</p>
              ) : needs.items.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">The matrix requires no training for this Work Position yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <TableMarkup.Root className="w-full border-collapse text-sm">
                    <TableMarkup.Head>
                      <TableMarkup.Row className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <TableMarkup.HeaderCell className="px-4 py-2 font-medium">No.</TableMarkup.HeaderCell>
                        <TableMarkup.HeaderCell className="px-4 py-2 font-medium">Code</TableMarkup.HeaderCell>
                        <TableMarkup.HeaderCell className="px-4 py-2 font-medium">Training</TableMarkup.HeaderCell>
                        <TableMarkup.HeaderCell className="px-4 py-2 font-medium">Group</TableMarkup.HeaderCell>
                        <TableMarkup.HeaderCell className="px-4 py-2 font-medium">Every Year</TableMarkup.HeaderCell>
                      </TableMarkup.Row>
                    </TableMarkup.Head>
                    <TableMarkup.Body className="divide-y divide-slate-100">
                      {needs.items.map((i, k) => (
                        <TableMarkup.Row key={i.rowNo} className="align-top">
                          <TableMarkup.Cell className="px-4 py-2 text-slate-500">{k + 1}</TableMarkup.Cell>
                          <TableMarkup.Cell className="whitespace-nowrap px-4 py-2 text-slate-700">{i.code ?? "—"}</TableMarkup.Cell>
                          <TableMarkup.Cell className="px-4 py-2 font-medium text-slate-900">{i.title}</TableMarkup.Cell>
                          <TableMarkup.Cell className="px-4 py-2"><Badge color={i.rowGroup === "FACTORY_GENERAL" ? "blue" : i.rowGroup === "DEPARTMENT_GENERAL" ? "amber" : "emerald"}>{i.rowGroup === "FACTORY_GENERAL" ? "Factory" : i.rowGroup === "DEPARTMENT_GENERAL" ? "Department" : "SOP"}</Badge></TableMarkup.Cell>
                          <TableMarkup.Cell className="px-4 py-2">{i.annualRequired ? "Yes" : "No"}</TableMarkup.Cell>
                        </TableMarkup.Row>
                      ))}
                    </TableMarkup.Body>
                  </TableMarkup.Root>
                </div>
              )}
              <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">This list is written in the training matrix of the department (each column is a Work Position) and changes with a new, approved version of it.</p>
            </section>
          </div>
        )}
      </FormModal>
    </div>
  );
}
