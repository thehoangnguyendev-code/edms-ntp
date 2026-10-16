import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconPlus } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField, Input } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { dictionaryApi } from "@/services/api/dictionary";
import { trainingError, trainingMatrixApi, type TrainingTopic } from "@/services/api/trainingActivities";
import { trainingAdministrationBase } from "@/components/ui/breadcrumb/breadcrumbs/settings";

const SCOPE_LABEL: Record<string, string> = { FACTORY_GENERAL: "General (whole factory)", DEPARTMENT_GENERAL: "General (one department)", OTHER: "Other" };

/** Standard training topics that are not SOPs (for example GMP, safety). They are chosen as rows of the training matrix. */
export function TrainingTopicsView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.admin.manage");
  const [topics, setTopics] = useState<TrainingTopic[]>();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<{ id: string | null; version?: number; code: string; name: string; scope: string; departmentId: string; active: boolean }>();
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    trainingMatrixApi.topics(search || undefined).then(setTopics).catch((e) => { setError(trainingError(e)); setTopics([]); });
  }, [search]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { dictionaryApi.getDepartments().then((l) => setDepartments(l.map((d) => ({ label: d.name, value: d.id })))).catch(() => setDepartments([])); }, []);

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await trainingMatrixApi.saveTopic(edit.id, { code: edit.code, name: edit.name.trim(), scope: edit.scope, departmentId: edit.scope === "DEPARTMENT_GENERAL" ? edit.departmentId : null, active: edit.active, version: edit.version });
      showToast({ type: "success", title: "Topic saved", message: edit.name });
      setEdit(undefined);
      load();
    } catch (e) {
      showToast({ type: "error", title: "The topic was not saved", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<TrainingTopic>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "code", header: "Code", cell: (t) => <span className="font-medium">{t.code}</span> },
    { id: "name", header: "Name", cell: (t) => <div className="max-w-96 whitespace-normal">{t.name}</div> },
    { id: "scope", header: "Scope", cell: (t) => SCOPE_LABEL[t.scope] + (t.departmentName ? ` — ${t.departmentName}` : "") },
    { id: "active", header: "Status", cell: (t) => <Badge color={t.active ? "emerald" : "slate"}>{t.active ? "Active" : "Inactive"}</Badge> },
    { id: "edit", header: "", cell: (t) => canManage ? <Button size="sm" variant="outline" onClick={() => setEdit({ id: t.id, version: t.version, code: t.code, name: t.name, scope: t.scope, departmentId: t.departmentId ?? "", active: t.active })}>Edit</Button> : null },
  ];
  const crumbs = [...trainingAdministrationBase(navigate), { label: "Training Topics", isActive: true }];
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title="Training Topics" breadcrumbItems={crumbs}
        actions={canManage ? <Button size="sm" onClick={() => setEdit({ id: null, code: "", name: "", scope: "FACTORY_GENERAL", departmentId: "", active: true })}><IconPlus className="mr-2 h-4 w-4" />New Topic</Button> : undefined} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="max-w-md"><Input placeholder="Search code or name…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {!topics ? <SectionLoading text="Loading topics…" /> : <DataTable rows={topics} getRowKey={(t) => t.id} columns={columns} emptyState={<TableEmptyState title="No Topics" description="Create the standard topics the matrix refers to." />} />}
      <FormModal isOpen={!!edit} onClose={() => setEdit(undefined)} onConfirm={() => void save()} title={edit?.id ? "Edit topic" : "New topic"} confirmText="Save" isLoading={busy}
        confirmDisabled={!edit || !edit.name.trim() || (!edit.id && !edit.code.trim()) || (edit.scope === "DEPARTMENT_GENERAL" && !edit.departmentId)} size="md">
        {edit && (
          <div className="grid gap-4">
            <FormField label="Code" required><Input value={edit.code} disabled={!!edit.id} maxLength={40} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></FormField>
            <FormField label="Name" required><Input value={edit.name} maxLength={255} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></FormField>
            <FormField label="Scope" required>
              <Select value={edit.scope} enableSearch={false} onChange={(v) => setEdit({ ...edit, scope: v })} options={Object.entries(SCOPE_LABEL).map(([value, label]) => ({ label, value }))} />
            </FormField>
            {edit.scope === "DEPARTMENT_GENERAL" && <FormField label="Department" required><Select value={edit.departmentId} onChange={(v) => setEdit({ ...edit, departmentId: v })} options={departments} /></FormField>}
            {edit.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active</label>}
          </div>
        )}
      </FormModal>
    </div>
  );
}
