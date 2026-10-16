import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconPlus } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { dictionaryApi } from "@/services/api/dictionary";
import { trainingError, trainingMatrixApi, type TrainingMatrixSummary } from "@/services/api/trainingActivities";
import { day, trainingBreadcrumbs, TRAINING_PAGES } from "./trainingLabels";

const OPEN_LABEL: Record<string, string> = { DRAFT: "Draft", PENDING_APPROVAL: "Waiting for approval" };

/** One matrix for each department: which version is effective and whether another one is being prepared. */
export function TrainingMatrixListView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.matrix.manage");
  const [rows, setRows] = useState<TrainingMatrixSummary[]>();
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    trainingMatrixApi.list().then(setRows).catch((e) => { setError(trainingError(e)); setRows([]); });
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    dictionaryApi.getDepartments().then((list) => setDepartments(list.map((d) => ({ label: d.name, value: d.id })))).catch(() => setDepartments([]));
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const v = await trainingMatrixApi.create(departmentId);
      showToast({ type: "success", title: "Matrix created", message: v.matrixCode });
      navigate(`/training-management/matrix-versions/${v.id}`);
    } catch (e) {
      showToast({ type: "error", title: "The matrix was not created", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<TrainingMatrixSummary>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "code", header: "Matrix", cell: (m) => <span className="font-medium">{m.code}</span> },
    { id: "department", header: "Department", cell: (m) => m.departmentName },
    {
      id: "effective",
      header: "Effective version",
      cell: (m) =>
        m.effectiveVersionId ? (
          <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/training-management/matrix-versions/${m.effectiveVersionId}`)}>
            Version {m.effectiveVersionNo} ({day(m.effectiveAt)})
          </button>
        ) : (
          "—"
        ),
    },
    {
      id: "open",
      header: "Being prepared",
      cell: (m) =>
        m.openVersionId ? (
          <button type="button" className="text-left" onClick={() => navigate(`/training-management/matrix-versions/${m.openVersionId}`)}>
            <Badge color="amber">Version {m.openVersionNo}: {OPEN_LABEL[m.openStatus ?? ""] ?? m.openStatus}</Badge>
          </button>
        ) : (
          "—"
        ),
    },
    { id: "open-detail", header: "", cell: (m) => <Button size="sm" variant="outline" onClick={() => navigate(`/training-management/matrices/${m.id}`)}>All versions</Button> },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader
        title={TRAINING_PAGES.matrices.title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "matrices")}
        actions={canManage ? <Button size="sm" onClick={() => setCreating(true)}><IconPlus className="mr-2 h-4 w-4" />New Matrix</Button> : undefined}
      />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!rows ? (
        <SectionLoading text="Loading matrices…" />
      ) : (
        <DataTable rows={rows} getRowKey={(m) => m.id} columns={columns} emptyState={<TableEmptyState title="No Training Matrix" description="Create the matrix of a department to define who must be trained on what." />} />
      )}
      <FormModal isOpen={creating} onClose={() => setCreating(false)} onConfirm={() => void create()} title="New training matrix" description="Each department has one matrix. The first version is a draft." confirmText="Create" isLoading={busy} confirmDisabled={!departmentId} size="md">
        <FormField label="Department" required>
          <Select value={departmentId} onChange={setDepartmentId} options={departments} placeholder="Choose a department" />
        </FormField>
      </FormModal>
    </div>
  );
}
