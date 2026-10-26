import { useCallback, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { resettingDates, useDateRange, useDepartmentOptions } from "../shared/useListFilters";
import { useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import {
  IconCheck,
  IconChecklist,
  IconChecks,
  IconFlagSpark,
  IconInfoCircle,
  IconPencilMinus,
  IconPlus,
  IconPrinter,
} from "@tabler/icons-react";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input } from "../shared/TrainingFields";
import { Select } from "@/components/ui/select/Select";
import {
  DataTable,
  useCustomColumnLayout,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import {
  ReportListToolbar,
  type ReportSelectFilter,
} from "@/features/report/shared/ReportListToolbar";
import {
  trainingError,
  trainingFormsApi,
  trainingRequirementsApi,
  type TrainingFormFormat,
  type TrainingRequirementSummary,
} from "@/services/api/trainingActivities";
import {
  day,
  saveBlob,
  trainingBreadcrumbs,
  TRAINING_PAGES,
  when,
} from "../shared/trainingLabels";

export const REQUIREMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending Review",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
};
export const REQUIREMENT_STATUS_COLOR: Record<
  string,
  "blue" | "amber" | "emerald"
> = {
  DRAFT: "blue",
  PENDING_REVIEW: "amber",
  PENDING_APPROVAL: "amber",
  APPROVED: "emerald",
};
const KIND_LABEL: Record<string, string> = {
  ANNUAL: "Annual",
  SOP_PERIODIC: "SOP periodic review",
};

/** Training requirements (APD.0118): the plan of the trainings of a year, reviewed and approved with signatures. */
export function TrainingRequirementListView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canPrepare = hasPermission("training.requirement.prepare");
  const [status, setStatus] = usePersistedState("training.requirements.status", "");
  const [kindFilter, setKindFilter] = usePersistedState("training.requirements.kind", "");
  const [departmentId, setDepartmentId] = usePersistedState("training.requirements.departmentId", "");
  const [yearFilter, setYearFilter] = usePersistedState("training.requirements.year", "");
  const departments = useDepartmentOptions();
  const dueRange = useDateRange("training.requirements.due", "Due Date Range");
  const createdRange = useDateRange("training.requirements.created", "Created Date Range");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [kind, setKind] = useState("ANNUAL");
  const [busy, setBusy] = useState(false);
  const menu = usePortalDropdown();

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingRequirementsApi.list(params).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extra = useMemo(() => ({
    status: status || undefined, kind: kindFilter || undefined, departmentId: departmentId || undefined, year: yearFilter || undefined,
    ...dueRange.params("dueFrom", "dueTo"), ...createdRange.params("createdFrom", "createdTo"),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [status, kindFilter, departmentId, yearFilter, dueRange.from, dueRange.to, createdRange.from, createdRange.to]);
  const table = useServerTable<TrainingRequirementSummary>({ persistKey: "training.requirements", liveTypes: ["TRAINING"],
    fetcher,
    defaultSortBy: "year",
    defaultSortDirection: "desc",
    extraParams: extra,
    initialItemsPerPage: 10,
  });

  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<TrainingRequirementSummary>[] = [
    {
      id: "rowNo",
      header: "No.",
      locked: true,
      cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1,
    },
    {
      id: "no",
      header: "Request number", sort: sorted("requestNo"),
      cell: (r) => (
        <button
          type="button"
          className="font-medium text-emerald-600 hover:underline"
          onClick={() => navigate(`/training-management/requirements/${r.id}`)}
        >
          {r.requestNo}
        </button>
      ),
    },
    { id: "year", header: "Year", sort: sorted("year"), cell: (r) => r.year },
    { id: "kind", header: "Type", sort: sorted("kind"), cell: (r) => KIND_LABEL[r.kind] ?? r.kind },
    { id: "department", header: "Department", sort: sorted("department"), cell: (r) => r.departmentName },
    { id: "lines", header: "Lines", sort: sorted("lines"), cell: (r) => r.lineCount },
    { id: "due", header: "Due Date", sort: sorted("dueBy"), cell: (r) => day(r.dueBy) },
    { id: "createdBy", header: "Opened By", sort: sorted("createdByName"), cell: (r) => r.createdByName ?? "—" },
    { id: "createdAt", header: "Created", sort: sorted("createdAt"), cell: (r) => when(r.createdAt) },
    {
      id: "status",
      header: "Status", sort: sorted("status"),
      cell: (r) => (
        <Badge color={REQUIREMENT_STATUS_COLOR[r.status]}>
          {REQUIREMENT_STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
  ];
  const action = {
    cell: (r: TrainingRequirementSummary) => (
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
  const { layout, control } = useCustomColumnLayout(
    "training.requirements",
    columns,
    action,
  );
  const actionRow = table.items.find((row) => row.id === menu.openId);
  const download = (r: TrainingRequirementSummary, format: TrainingFormFormat) =>
    trainingFormsApi
      .requirement(r.id, format)
      .then((b) => saveBlob(b, `${r.requestNo.replace(/\//g, "-")}-APD.0118.${format}`))
      .catch((e) =>
        showToast({
          type: "error",
          title: "The requirement was not exported",
          message: trainingError(e),
        }),
      );
  const filters: ReportSelectFilter[] = [
    {
      id: "status",
      label: "Status",
      value: status,
      options: [
        { label: "All", value: "" },
        ...Object.entries(REQUIREMENT_STATUS_LABEL).map(([value, label]) => ({
          label,
          value,
        })),
      ],
      onChange: (v) => {
        setStatus(v);
        table.setCurrentPage(1);
      },
    },
    { id: "kind", label: "Type", value: kindFilter, options: [{ label: "All", value: "" }, ...Object.entries(KIND_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setKindFilter(v); table.setCurrentPage(1); } },
    { id: "department", label: "Department", value: departmentId, options: [{ label: "All", value: "" }, ...departments], onChange: (v) => { setDepartmentId(v); table.setCurrentPage(1); } },
    { id: "year", label: "Year", value: yearFilter, options: [{ label: "All", value: "" }, ...Array.from({ length: 6 }, (_x, i) => String(new Date().getFullYear() + 1 - i)).map((y) => ({ label: y, value: y }))], onChange: (v) => { setYearFilter(v); table.setCurrentPage(1); } },
  ];

  const create = async () => {
    setBusy(true);
    try {
      const created = await trainingRequirementsApi.create({
        year: Number(year),
        kind,
      });
      showToast({
        type: "success",
        title: "Requirement created",
        message: created.requestNo,
      });
      setCreating(false);
      navigate(`/training-management/requirements/${created.id}`);
    } catch (e) {
      showToast({
        type: "error",
        title: "The requirement was not created",
        message: trainingError(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader
        title={TRAINING_PAGES.requirements.title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "requirements")}
        actions={
          canPrepare ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <IconPlus className="mr-2 h-4 w-4" />
              New Requirement
            </Button>
          ) : undefined
        }
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <ReportListToolbar
        searchPlaceholder="Search request number…"
        search={table.searchQuery}
        onSearch={(v) => {
          table.setSearchQuery(v);
          table.setCurrentPage(1);
        }}
        filters={filters}
        dates={resettingDates([dueRange.filter, createdRange.filter], () => table.setCurrentPage(1))}
        hasActiveFilters={Boolean(status || kindFilter || departmentId || yearFilter || dueRange.isSet || createdRange.isSet || table.searchQuery)}
        onClear={() => {
          setStatus("");
          setKindFilter("");
          setDepartmentId("");
          setYearFilter("");
          dueRange.clear();
          createdRange.clear();
          table.setCurrentPage(1);
        }}
        customControl={control}
      >
        <DataTable
          rows={table.items}
          getRowKey={(r) => r.id}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading…" />}
          columns={columns}
          columnLayout={layout}
          action={action}
          emptyState={
            <TableEmptyState
              title="No Training Requirements"
              description="The plan of the trainings of a year appears here."
            />
          }
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
      <PortalDropdownMenu
        isOpen={!!actionRow}
        onClose={menu.close}
        position={menu.position}
        minWidth={240}
      >
        {actionRow && (
          <div className="py-1">
            {[
              {
                show: true,
                icon: <IconInfoCircle className="h-4 w-4" />,
                label: "View Details",
                run: () =>
                  navigate(`/training-management/requirements/${actionRow.id}`),
              },
              {
                show: actionRow.actions?.edit,
                icon: <IconPencilMinus className="h-4 w-4" />,
                label: "Edit Training Requirement",
                run: () =>
                  navigate(
                    `/training-management/requirements/${actionRow.id}/edit`,
                  ),
              },
              {
                show: actionRow.actions?.review,
                icon: <IconCheck className="h-4 w-4" />,
                label: "Review Training Requirement",
                run: () =>
                  navigate(
                    `/training-management/requirements/${actionRow.id}/review`,
                  ),
              },
              {
                show: actionRow.actions?.approve,
                icon: <IconChecks className="h-4 w-4" />,
                label: "Approve Training Requirement",
                run: () =>
                  navigate(
                    `/training-management/requirements/${actionRow.id}/approve`,
                  ),
              },
              {
                show: actionRow.actions?.track,
                icon: <IconFlagSpark className="h-4 w-4" />,
                label: "Follow Training Requirement",
                run: () =>
                  navigate(
                    `/training-management/requirements/${actionRow.id}/track`,
                  ),
              },
              {
                show: actionRow.actions?.print,
                icon: <IconPrinter className="h-4 w-4" />,
                label: "Download Word",
                run: () => void download(actionRow, "docx"),
              },
              {
                show: actionRow.actions?.print,
                icon: <IconPrinter className="h-4 w-4" />,
                label: "Download PDF",
                run: () => void download(actionRow, "pdf"),
              },
            ]
              .filter((item) => item.show)
              .map((item) => (
                <DropdownMenuItem
                  key={item.label}
                  icon={item.icon}
                  onClick={() => {
                    item.run();
                    menu.close();
                  }}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
          </div>
        )}
      </PortalDropdownMenu>
      <FormModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onConfirm={() => void create()}
        title="New Training Requirement"
        description="A draft for your department. The request number is issued by the system."
        confirmText="Create draft"
        isLoading={busy}
        confirmDisabled={!year}
        size="md"
      >
        <div className="grid gap-4">
          <FormField label="Year" required>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </FormField>
          <FormField label="Type" required>
            <Select
              value={kind}
              enableSearch={false}
              onChange={setKind}
              options={Object.entries(KIND_LABEL).map(([value, label]) => ({
                label,
                value,
              }))}
            />
          </FormField>
        </div>
      </FormModal>
    </div>
  );
}
