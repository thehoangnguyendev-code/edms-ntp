import { TrainingPersonName } from "../shared/TrainingPersonName";
import {
  IconCertificate,
  IconEye,
  IconFileSearch,
  IconSignature,
} from "@tabler/icons-react";
import { useTrainingRowMenu } from "../shared/useTrainingRowMenu";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useNavigate } from "react-router-dom";
import { IconPlus } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
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
  trainingActivitiesApi,
  trainingError,
  trainingJobsApi,
  trainingMatrixApi,
  type TrainingJobSummary,
  type TrainingPosition,
} from "@/services/api/trainingActivities";
import {
  day,
  trainingBreadcrumbs,
  TRAINING_PAGES,
} from "../shared/trainingLabels";
import {
  resettingDates,
  useDateRange,
  useDepartmentOptions,
} from "../shared/useListFilters";

export const JOB_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_RECEIVER: "Waiting for the employee",
  EFFECTIVE: "Effective",
  SUPERSEDED: "Replaced",
  CANCELLED: "Cancelled",
};
export const JOB_STATUS_COLOR: Record<
  string,
  "emerald" | "amber" | "slate" | "red" | "blue"
> = {
  DRAFT: "blue",
  PENDING_RECEIVER: "amber",
  EFFECTIVE: "emerald",
  SUPERSEDED: "slate",
  CANCELLED: "red",
};

/** Job assignments (APD.0024): the position a person is given, after the training the matrix requires for it. */
export function TrainingJobListView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.job_assignment.manage");
  const [status, setStatus] = usePersistedState("training.jobs.status", "");
  const [caseType, setCaseType] = usePersistedState(
    "training.jobs.caseType",
    "",
  );
  const [departmentFilter, setDepartmentFilter] = usePersistedState(
    "training.jobs.departmentId",
    "",
  );
  const [positionFilter, setPositionFilter] = usePersistedState(
    "training.jobs.positionId",
    "",
  );
  const departments = useDepartmentOptions();
  const effectiveRange = useDateRange(
    "training.jobs.effective",
    "Effective Date Range",
  );
  const createdRange = useDateRange(
    "training.jobs.created",
    "Created Date Range",
  );
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [positions, setPositions] = useState<TrainingPosition[]>([]);
  const [personId, setPersonId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [people, setPeople] = useState<{ label: string; value: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    trainingMatrixApi
      .positions()
      .then(setPositions)
      .catch(() => setPositions([]));
  }, []);
  const searchPeople = useCallback(async (query: string) => {
    const list = await trainingActivitiesApi.people(query);
    const mapped = list.map((p) => ({
      label: `${p.fullName}${p.employeeCode ? ` (${p.employeeCode})` : ""}`,
      value: p.id,
    }));
    setPeople(mapped);
    return mapped;
  }, []);
  useEffect(() => {
    if (creating) void searchPeople("");
  }, [creating, searchPeople]);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingJobsApi.list(params).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extra = useMemo(
    () => ({
      status: status || undefined,
      caseType: caseType || undefined,
      departmentId: departmentFilter || undefined,
      positionId: positionFilter || undefined,
      ...effectiveRange.params("effectiveFrom", "effectiveTo"),
      ...createdRange.params("createdFrom", "createdTo"),
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }),
    [
      status,
      caseType,
      departmentFilter,
      positionFilter,
      effectiveRange.from,
      effectiveRange.to,
      createdRange.from,
      createdRange.to,
    ],
  );
  const table = useServerTable<TrainingJobSummary>({
    persistKey: "training.jobs",
    liveTypes: ["TRAINING"],
    fetcher,
    defaultSortBy: "createdAt",
    defaultSortDirection: "desc",
    extraParams: extra,
    initialItemsPerPage: 10,
  });

  const sorted = (key: string) => ({
    direction:
      table.sortConfig.key === key ? table.sortConfig.direction : undefined,
    onSort: () => table.handleSort(key),
  });

  const columns: DataTableColumn<TrainingJobSummary>[] = [
    {
      id: "rowNo",
      header: "No.",
      locked: true,
      cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1,
    },
    {
      id: "employeeCode",
      header: "Employee ID",
      sort: sorted("employeeCode"),
      cell: (r) => r.employeeCode ?? "—",
    },
    {
      id: "name",
      header: "Full Name",
      sort: sorted("employee"),
      cell: (r) => (
        <TrainingPersonName
          fullName={r.fullName}
          avatar={r.avatar}
          onClick={() =>
            navigate(`/training-management/job-assignments/${r.id}`)
          }
        />
      ),
    },
    {
      id: "position",
      header: "Position",
      sort: sorted("position"),
      cell: (r) => r.positionName,
    },
    {
      id: "department",
      header: "Department",
      sort: sorted("department"),
      cell: (r) => r.departmentName,
    },
    {
      id: "case",
      header: "Type",
      sort: sorted("type"),
      cell: (r) => (r.caseType === "INITIAL" ? "Initial" : "Change"),
    },
    {
      id: "issue",
      header: "Issue No.",
      sort: sorted("issue"),
      cell: (r) => r.issueNo,
    },
    {
      id: "status",
      header: "Status",
      sort: sorted("status"),
      cell: (r) => (
        <Badge color={JOB_STATUS_COLOR[r.status]}>
          {JOB_STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
    {
      id: "effective",
      header: "Effective Date",
      sort: sorted("effective"),
      cell: (r) => day(r.effectiveAt),
    },
    {
      id: "createdAt",
      header: "Created On",
      sort: sorted("createdAt"),
      cell: (r) => day(r.createdAt),
    },
  ];
  // The last column leads from a job assignment to the screens about the same person.
  const rowMenu = useTrainingRowMenu(table.items, (r) => {
    const who = encodeURIComponent(r.employeeCode ?? r.fullName);
    return [
      {
        label: "View Job Assignment",
        icon: <IconEye className="h-4 w-4" />,
        onClick: () => navigate(`/training-management/job-assignments/${r.id}`),
      },
      ...(hasPermission("training.record.view")
        ? [
            {
              label: "View Training Records",
              icon: <IconFileSearch className="h-4 w-4" />,
              onClick: () =>
                navigate(`/training-management/records?search=${who}`),
            },
          ]
        : []),
      {
        label: "View Training Reviews",
        icon: <IconCertificate className="h-4 w-4" />,
        onClick: () =>
          navigate(`/training-management/personnel-reviews?search=${who}`),
      },
      ...(hasPermission("training.signature.view") ||
      hasPermission("training.signature.manage")
        ? [
            {
              label: "View Specimen Signatures",
              icon: <IconSignature className="h-4 w-4" />,
              onClick: () =>
                navigate(
                  `/training-management/specimen-signatures?search=${who}`,
                ),
            },
          ]
        : []),
    ];
  });
  const { layout, control } = useCustomColumnLayout(
    "training.job.assignments",
    columns,
    rowMenu.action,
  );
  const filters: ReportSelectFilter[] = [
    {
      id: "status",
      label: "Status",
      value: status,
      options: [
        { label: "All", value: "" },
        ...Object.entries(JOB_STATUS_LABEL).map(([value, label]) => ({
          label,
          value,
        })),
      ],
      onChange: (v) => {
        setStatus(v);
        table.setCurrentPage(1);
      },
    },
    {
      id: "caseType",
      label: "Type",
      value: caseType,
      options: [
        { label: "All", value: "" },
        { label: "Initial", value: "INITIAL" },
        { label: "Change", value: "CHANGE" },
      ],
      onChange: (v) => {
        setCaseType(v);
        table.setCurrentPage(1);
      },
    },
    {
      id: "department",
      label: "Department",
      value: departmentFilter,
      options: [{ label: "All", value: "" }, ...departments],
      onChange: (v) => {
        setDepartmentFilter(v);
        table.setCurrentPage(1);
      },
    },
    {
      id: "position",
      label: "Position",
      value: positionFilter,
      options: [
        { label: "All", value: "" },
        ...positions.map((p) => ({ label: p.name, value: p.id })),
      ],
      onChange: (v) => {
        setPositionFilter(v);
        table.setCurrentPage(1);
      },
    },
  ];

  const create = async () => {
    setBusy(true);
    try {
      const created = await trainingJobsApi.create({
        personUserId: personId,
        positionId,
        duties: [],
      });
      showToast({
        type: "success",
        title: "Draft created",
        message: created.personName,
      });
      setCreating(false);
      navigate(`/training-management/job-assignments/${created.id}`);
    } catch (e) {
      showToast({
        type: "error",
        title: "The assignment was not created",
        message: trainingError(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader
        title={TRAINING_PAGES.jobs.title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "jobs")}
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <IconPlus className="mr-2 h-4 w-4" />
              New Job Assignment
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
        searchPlaceholder="Search employee or position…"
        search={table.searchQuery}
        onSearch={(v) => {
          table.setSearchQuery(v);
          table.setCurrentPage(1);
        }}
        filters={filters}
        dates={resettingDates(
          [effectiveRange.filter, createdRange.filter],
          () => table.setCurrentPage(1),
        )}
        hasActiveFilters={Boolean(
          status ||
          caseType ||
          departmentFilter ||
          positionFilter ||
          effectiveRange.isSet ||
          createdRange.isSet ||
          table.searchQuery,
        )}
        onClear={() => {
          setStatus("");
          setCaseType("");
          setDepartmentFilter("");
          setPositionFilter("");
          effectiveRange.clear();
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
          action={rowMenu.action}
          emptyState={
            <TableEmptyState
              title="No Job Assignments"
              description="Assignments of people to positions appear here."
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
      {rowMenu.node}
      <FormModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onConfirm={() => void create()}
        title="New job assignment"
        description="A draft is created. The matrix training of the person is checked before it can be sent."
        confirmText="Create draft"
        isLoading={busy}
        confirmDisabled={!personId || !positionId}
        size="md"
      >
        <div className="grid gap-4">
          <FormField label="Employee" required>
            <Select
              value={personId}
              onChange={setPersonId}
              options={people}
              onSearch={searchPeople}
              placeholder="Search by name"
            />
          </FormField>
          <FormField label="Position" required>
            <Select
              value={positionId}
              onChange={setPositionId}
              options={positions
                .filter((p) => p.departmentId)
                .map((p) => ({
                  label: `${p.name} (${p.departmentName})`,
                  value: p.id,
                }))}
              placeholder="Choose a position"
            />
          </FormField>
        </div>
      </FormModal>
    </div>
  );
}
