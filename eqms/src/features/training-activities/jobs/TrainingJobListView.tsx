import { TrainingPersonName } from "../shared/TrainingPersonName";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { PersonJobRolesPanel } from "./PersonJobRolesPanel";
import { RadioGroup } from "@/components/ui/radio";
import { Input } from "../shared/TrainingFields";
import { RequiredTrainingsField, pickedIds, type PickedTraining } from "./RequiredTrainingsField";
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
  type TrainingEligibility,
  trainingActivitiesApi,
  trainingError,
  trainingJobsApi,
  trainingWorkPositionApi,
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
  { id: "roles", label: "Job Roles Held" },
];

export function TrainingJobListView() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("assignments");
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
  // The Job Roles that the person holds through a signed job assignment: a later Job Role replaces one of them or is added to them.
  const [held, setHeld] = useState<
    { jobRoleId: string; positionName: string }[]
  >([]);
  const [mode, setMode] = useState<"CHANGE" | "ADDITIONAL">("ADDITIONAL");
  const [replaces, setReplaces] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [required, setRequired] = useState<PickedTraining[]>([]);
  // The check is made at once: what the matrix requires for the Job Role and what is ticked, against the training records of the person.
  const [check, setCheck] = useState<TrainingEligibility>();
  useEffect(() => {
    setCheck(undefined);
    if (!creating || !personId || !positionId) return;
    let live = true;
    const ids = pickedIds(required);
    trainingJobsApi.eligibility(personId, positionId, ids.topicIds, ids.documentIds).then((c) => { if (live) setCheck(c); }).catch(() => { if (live) setCheck(undefined); });
    return () => { live = false; };
  }, [creating, personId, positionId, required]);
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
  useEffect(() => {
    setHeld([]);
    setReplaces("");
    if (!personId) return;
    let live = true;
    trainingWorkPositionApi
      .of(personId)
      .then((w) => {
        if (live)
          setHeld((w.roles ?? []).filter((r) => r.source === "JOB_ASSIGNMENT"));
      })
      .catch(() => {
        if (live) setHeld([]);
      });
    return () => {
      live = false;
    };
  }, [personId]);

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
      header: "Job Role",
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
      label: "Job Role",
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
        requiredTopicIds: pickedIds(required).topicIds,
        requiredDocumentIds: pickedIds(required).documentIds,
        ...(held.length > 0
          ? {
              mode,
              replacesPositionId:
                mode === "CHANGE" ? replaces || held[0].jobRoleId : undefined,
              changeReason: mode === "CHANGE" ? changeReason.trim() : undefined,
            }
          : {}),
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
          canManage && tab === "assignments" ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <IconPlus className="mr-2 h-4 w-4" />
              New Job Assignment
            </Button>
          ) : undefined
        }
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TabNav tabs={TABS} activeTab={tab} onChange={setTab} variant="underline" ariaLabel="Job assignments" tabIdPrefix="jobs-tab" panelIdPrefix="jobs-panel" />
      </div>
      {tab === "roles" && <PersonJobRolesPanel />}
      {tab === "assignments" && (
        <>
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
              description="Assignments of Job Roles to people appear here."
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
      <FormModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onConfirm={() => void create()}
        title="New Job Assignment"
        description="A draft is created. The matrix training of the person is checked before it can be sent."
        confirmText="Create draft"
        isLoading={busy}
        confirmDisabled={
          !personId ||
          !positionId ||
          (held.length > 0 && !changeReason.trim())
        }
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
          <FormField label="Job Role" required>
            <Select
              value={positionId}
              onChange={setPositionId}
              options={positions
                .filter(
                  (p) =>
                    p.departmentId && !held.some((h) => h.jobRoleId === p.id),
                )
                .map((p) => ({
                  label: `${p.name} (${p.departmentName})`,
                  value: p.id,
                }))}
              placeholder="Choose a Job Role"
            />
          </FormField>
          <FormField label="Other trainings required" hint="Besides the matrix of the Job Role: tick the topics or SOPs the person must have completed first.">
            <RequiredTrainingsField value={required} onChange={setRequired} />
          </FormField>
          {check && (
            <div role="status" className={`rounded-lg border px-3 py-2 text-sm ${check.matrixMissing || (check.missingCount ?? 0) > 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
              {check.matrixMissing ? "The department has no effective matrix: an exception is needed to go ahead." : (check.missingCount ?? 0) === 0 ? `Training check: complete (${check.items.length} required).` : (
                <>
                  <p className="font-medium">Not trained yet ({check.missingCount} of {check.items.length}). The assignment cannot be signed until they are done, or an exception is approved:</p>
                  <ul className="mt-1 list-disc pl-5">{check.items.filter((i) => !i.lastDone).map((i) => <li key={`${i.code}|${i.title}`}>{i.code ? `${i.code} — ` : ""}{i.title}{i.source === "CHOSEN" ? " (ticked)" : ""}</li>)}</ul>
                </>
              )}
            </div>
          )}
          {held.length > 0 && (
            <>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                This person holds: {held.map((h) => h.positionName).join(", ")}.
              </p>
              <FormField label="This Job Role" required>
                <RadioGroup
                  name="job-mode"
                  layout="horizontal"
                  value={mode}
                  onChange={(v) => setMode(v as "CHANGE" | "ADDITIONAL")}
                  options={[
                    { label: "Is added to the ones held", value: "ADDITIONAL" },
                    { label: "Replaces one held", value: "CHANGE" },
                  ]}
                />
              </FormField>
              {mode === "CHANGE" && (
                <>
                  {held.length > 1 && (
                    <FormField label="Job Role to replace" required>
                      <Select
                        value={replaces || held[0].jobRoleId}
                        onChange={setReplaces}
                        options={held.map((h) => ({
                          label: h.positionName,
                          value: h.jobRoleId,
                        }))}
                      />
                    </FormField>
                  )}
                  <FormField label="Reason for the change" required>
                    <Input
                      value={changeReason}
                      maxLength={500}
                      onChange={(e) => setChangeReason(e.target.value)}
                    />
                  </FormField>
                </>
              )}
            </>
          )}
        </div>
      </FormModal>
    </div>
  );
}
