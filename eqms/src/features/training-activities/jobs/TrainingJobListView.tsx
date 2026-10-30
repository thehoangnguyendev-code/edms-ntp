import { TrainingPersonName } from "../shared/TrainingPersonName";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { PersonJobRolesPanel } from "./PersonJobRolesPanel";
import { WorkPositionsPreview } from "./WorkPositionsPreview";
import {
  IconChecks,
  IconEye,
  IconInfoCircle,
  IconPencilMinus,
} from "@tabler/icons-react";
import { useTrainingRowMenu } from "../shared/useTrainingRowMenu";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useNavigate } from "react-router-dom";
import { IconPlus } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import {
  DataTable,
  useCustomColumnLayout,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { usePermissions } from "@/hooks/usePermissions";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import {
  ReportListToolbar,
  type ReportSelectFilter,
} from "@/features/report/shared/ReportListToolbar";
import {
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

/** The one item of the Action menu: what is waiting on this job assignment. Every other status just opens it. */
export const JOB_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_RECEIVER: "Pending Employee Acceptance",
  EFFECTIVE: "Effective",
  OBSOLETED: "Obsoleted",
  CANCELLED: "Cancelled",
};
export const JOB_STATUS_COLOR: Record<
  string,
  "emerald" | "amber" | "slate" | "red" | "blue"
> = {
  DRAFT: "blue",
  PENDING_RECEIVER: "amber",
  EFFECTIVE: "emerald",
  OBSOLETED: "slate",
  CANCELLED: "red",
};

/** Job assignments (APD.0024): the position a person is given, after the training the matrix requires for it. */
const TABS: TabItem[] = [
  { id: "assignments", label: "Job Assignments" },
  { id: "roles", label: "Work Positions Held" },
];

export function TrainingJobListView() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("assignments");
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
  const [positions, setPositions] = useState<TrainingPosition[]>([]);
  useEffect(() => {
    trainingMatrixApi
      .positions()
      .then(setPositions)
      .catch(() => setPositions([]));
  }, []);
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
      header: "Work Position",
      sort: sorted("position"),
      cell: (r) => <WorkPositionsPreview assignmentId={r.id} personName={r.fullName} positions={r.positions} totalCount={r.positionsCount} fallback={r.positionName} />,
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
  // One item for each thing the row leads to; the server says which ones the person may use. The people, records and signatures that belong to the same person are in the
  // card under the buttons of the job assignment itself.
  const openJob = (id: string) =>
    navigate(`/training-management/job-assignments/${id}`);
  const rowMenu = useTrainingRowMenu(table.items, (r) => [
    ...(r.actions.view
      ? [
          {
            label: "View Details",
            icon: <IconInfoCircle className="h-4 w-4" />,
            onClick: () => openJob(r.id),
          },
        ]
      : []),
    ...(r.actions.continueDraft
      ? [
          {
            label: "Continue Draft",
            icon: <IconPencilMinus className="h-4 w-4" />,
            onClick: () => openJob(r.id),
          },
        ]
      : []),
    ...(r.actions.review
      ? [
          {
            label: "Review and Accept",
            icon: <IconChecks className="h-4 w-4" />,
            onClick: () => openJob(r.id),
          },
        ]
      : []),
  ]);
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
      label: "Work Position",
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

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader
        title={TRAINING_PAGES.jobs.title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "jobs")}
        actions={
          canManage && tab === "assignments" ? (
            <Button size="sm" onClick={() => navigate("/training-management/job-assignments/new")}>
              <IconPlus className="mr-2 h-4 w-4" />
              New Job Assignment
            </Button>
          ) : undefined
        }
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TabNav tabs={TABS} activeTab={tab} onChange={setTab} variant="underline" ariaLabel="Job assignments" tabIdPrefix="jobs-tab" panelIdPrefix="jobs-panel" />
        <div id={`jobs-panel-${tab}`} role="tabpanel" aria-labelledby={`jobs-tab-${tab}`} className="min-w-0">
      {tab === "roles" && <PersonJobRolesPanel />}
      {tab === "assignments" && (
        <>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <ReportListToolbar
        framed={false}
        searchPlaceholder="Search employee or work position…"
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
              description="Assignments of Work Positions to people appear here."
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
        </>
      )}
        </div>
      </div>
    </div>
  );
}
