import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { IconInfoCircle, IconListDetails, IconPlus } from "@tabler/icons-react";
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
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast/Toast";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { usePermissions } from "@/hooks/usePermissions";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { dictionaryApi } from "@/services/api/dictionary";
import { trainingError, trainingMatrixApi, type TrainingMatrixSummary } from "@/services/api/trainingActivities";
import { day, trainingBreadcrumbs, TRAINING_PAGES } from "../shared/trainingLabels";

const OPEN_LABEL: Record<string, string> = { DRAFT: "Draft", PENDING_APPROVAL: "Waiting for approval" };
const STATE_OPTIONS = [
  { label: "All", value: "" },
  { label: "Has an effective version", value: "EFFECTIVE" },
  { label: "No effective version", value: "NO_EFFECTIVE" },
  { label: "A version is being prepared", value: "IN_PREPARATION" },
];

/** One matrix for each department: which version is effective and whether another one is being prepared. Search, filter and paging are done by the server. */
export function TrainingMatrixListView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.matrix.manage");
  const menu = usePortalDropdown();
  const drag = useTableDragScroll();
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [busy, setBusy] = useState(false);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingMatrixApi.list(params).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extraParams = useMemo(() => ({ state: state || undefined }), [state]);
  const table = useServerTable<TrainingMatrixSummary>({ fetcher, defaultSortBy: "department", defaultSortDirection: "asc", extraParams, initialItemsPerPage: 10 });
  useEffect(() => setError(""), [table.items]);
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
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "code", header: "Matrix", cell: (m) => <span className="font-medium text-slate-900">{m.code}</span> },
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
  ];
  const action = {
    cell: (m: TrainingMatrixSummary) => (
      <button
        type="button"
        ref={menu.getRef(m.id)}
        aria-label="More actions"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
        onClick={(event) => menu.toggle(m.id, event)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };
  const { layout, control } = useCustomColumnLayout("training.matrices.list", columns, action);
  const actionRow = table.items.find((row) => row.id === menu.openId);
  const filters: ReportSelectFilter[] = [
    { id: "state", label: "Version", value: state, options: STATE_OPTIONS, onChange: (v) => { setState(v); table.setCurrentPage(1); } },
  ];

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col gap-4 md:gap-6">
      <PageHeader
        title={TRAINING_PAGES.matrices.title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "matrices")}
        actions={canManage ? <Button size="sm" onClick={() => setCreating(true)}><IconPlus className="mr-2 h-4 w-4" />New Matrix</Button> : undefined}
      />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder="Search matrix or department…"
        search={table.searchQuery}
        onSearch={(value) => { table.setSearchQuery(value); table.setCurrentPage(1); }}
        filters={filters}
        dates={[]}
        hasActiveFilters={Boolean(state || table.searchQuery)}
        onClear={() => { setState(""); table.setSearchQuery(""); table.setCurrentPage(1); }}
        customControl={control}
      >
        <DataTable
          rows={table.items}
          getRowKey={(m) => m.id}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading matrices…" />}
          emptyState={<TableEmptyState title="No Training Matrix" description="Create the matrix of a department to define who must be trained on what." />}
          scrollerRef={drag.scrollerRef}
          scrollProps={drag.dragEvents}
          isDragging={drag.isDragging}
          columns={columns}
          columnLayout={layout}
          action={action}
          pagination={
            table.totalItems > 0 ? (
              <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />
            ) : undefined
          }
        />
      </ReportListToolbar>
      <PortalDropdownMenu isOpen={!!actionRow} onClose={menu.close} position={menu.position} minWidth={220}>
        {actionRow && (
          <div className="py-1">
            {actionRow.effectiveVersionId && (
              <DropdownMenuItem icon={<IconInfoCircle className="h-4 w-4" />} onClick={() => { navigate(`/training-management/matrix-versions/${actionRow.effectiveVersionId}`); menu.close(); }}>View Effective Version</DropdownMenuItem>
            )}
            {actionRow.openVersionId && (
              <DropdownMenuItem icon={<IconInfoCircle className="h-4 w-4" />} onClick={() => { navigate(`/training-management/matrix-versions/${actionRow.openVersionId}`); menu.close(); }}>Open Version Being Prepared</DropdownMenuItem>
            )}
            <DropdownMenuItem icon={<IconListDetails className="h-4 w-4" />} onClick={() => { navigate(`/training-management/matrices/${actionRow.id}`); menu.close(); }}>All Versions</DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>
      <FormModal isOpen={creating} onClose={() => setCreating(false)} onConfirm={() => void create()} title="New training matrix" description="Each department has one matrix. The first version is a draft that is edited, then sent for approval." confirmText="Create" isLoading={busy} confirmDisabled={!departmentId} size="md">
        <FormField label="Department" required>
          <Select value={departmentId} onChange={setDepartmentId} options={departments} placeholder="Choose a department" />
        </FormField>
      </FormModal>
    </div>
  );
}
