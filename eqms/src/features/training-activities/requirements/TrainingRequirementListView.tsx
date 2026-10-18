import { useCallback, useMemo, useState } from "react";
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
  trainingRequirementsApi,
  type TrainingRequirementSummary,
} from "@/services/api/trainingActivities";
import {
  day,
  saveBlob,
  trainingBreadcrumbs,
  TRAINING_PAGES,
} from "../shared/trainingLabels";

export const REQUIREMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Waiting for review",
  PENDING_APPROVAL: "Waiting for approval",
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
  const [status, setStatus] = useState("");
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
  const extra = useMemo(() => ({ status: status || undefined }), [status]);
  const table = useServerTable<TrainingRequirementSummary>({
    fetcher,
    defaultSortBy: "year",
    defaultSortDirection: "desc",
    extraParams: extra,
    initialItemsPerPage: 10,
  });

  const columns: DataTableColumn<TrainingRequirementSummary>[] = [
    {
      id: "rowNo",
      header: "No.",
      locked: true,
      cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1,
    },
    {
      id: "no",
      header: "Request number",
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
    { id: "year", header: "Year", cell: (r) => r.year },
    { id: "kind", header: "Type", cell: (r) => KIND_LABEL[r.kind] ?? r.kind },
    { id: "department", header: "Department", cell: (r) => r.departmentName },
    { id: "lines", header: "Lines", cell: (r) => r.lineCount },
    { id: "due", header: "Due by", cell: (r) => day(r.dueBy) },
    {
      id: "status",
      header: "Status",
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
  const print = (r: TrainingRequirementSummary) =>
    trainingRequirementsApi
      .print(r.id)
      .then((b) => saveBlob(b, `${r.requestNo.replace(/\//g, "-")}.pdf`))
      .catch((e) =>
        showToast({
          type: "error",
          title: "The PDF could not be printed",
          message: trainingError(e),
        }),
      );
  const filters: ReportSelectFilter[] = [
    {
      id: "status",
      label: "Status",
      value: status,
      options: [
        { label: "All statuses", value: "" },
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
        dates={[]}
        hasActiveFilters={Boolean(status)}
        onClear={() => {
          setStatus("");
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
                label: "Print PDF",
                run: () => void print(actionRow),
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
        title="New training requirement"
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
