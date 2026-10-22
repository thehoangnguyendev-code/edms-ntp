import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormSection } from "@/components/ui/form/FormSection";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Drawer } from "@/components/ui/drawer/Drawer";
import { DataTable } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Pencil, Pause, Play, UserCog, Plus } from "lucide-react";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { ReportListToolbar } from "../shared/ReportListToolbar";
import { scheduleStatusLabel } from "../shared/reportLabels";
import { type DataTableAction, type DataTableColumn, useCustomColumnLayout } from "@/components/ui/table/DataTable";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { usePermissions } from "@/hooks/usePermissions";
import {
  reportsApi,
  type ReportSchedule,
  type ReportSchedulePage,
  type ReportScheduleDetail,
  type ReportRecipientCandidate,
  type ReportFormat,
} from "@/services/api/reports";
import {
  reportError,
  type ReportTemplate,
} from "@/services/api/reportTemplates";
import { ReportLookup } from "../templates/ReportLookup";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { IconPencilMinus, IconReplaceUser } from "@tabler/icons-react";

export function ScheduledReportsView() {
  const navigate = useNavigate();
  const menu = usePortalDropdown();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission([
    "reports.schedule.manage",
    "report.module.export",
  ]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<ReportSchedulePage>({
    data: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ownerChange, setOwnerChange] = useState<{
    id: string;
    name: string;
    ownerUserId: string;
    reason: string;
    busy: boolean;
    error: string;
    options: ReportRecipientCandidate[];
  }>();
  const patchOwner = (patch: Partial<NonNullable<typeof ownerChange>>) =>
    setOwnerChange((v) => (v ? { ...v, ...patch } : v));
  /** The owner is chosen from people who can receive a report, so the choice is never a bare user id. */
  const openOwnerChange = async (row: ReportSchedule) => {
    setOwnerChange({
      id: row.id,
      name: row.name,
      ownerUserId: row.ownerUserId ?? "",
      reason: "",
      busy: false,
      error: "",
      options: [],
    });
    try {
      const options = await reportsApi.listScheduleRecipients();
      setOwnerChange((v) => (v && v.id === row.id ? { ...v, options } : v));
    } catch (e) {
      setOwnerChange((v) => (v && v.id === row.id ? { ...v, error: reportError(e) } : v));
    }
  };
  const saveOwner = async () => {
    if (!ownerChange) return;
    patchOwner({ busy: true, error: "" });
    try {
      await reportsApi.changeScheduleOwner(
        ownerChange.id,
        ownerChange.ownerUserId,
        ownerChange.reason.trim(),
      );
      setOwnerChange(undefined);
      setNotice("Schedule owner changed.");
      setRefresh((n) => n + 1);
    } catch (e) {
      patchOwner({ busy: false, error: reportError(e) });
    }
  };
  const drag = useTableDragScroll();
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(input);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    reportsApi
      .searchSchedules({ search, status, page, sortBy: sort, direction })
      .then((v) => {
        if (alive) setData(v);
      })
      .catch((e) => {
        if (alive) setError(reportError(e));
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [search, status, page, sort, direction, refresh]);
  const sortBy = (field: string) => {
    setSort(field);
    setDirection(sort === field && direction === "asc" ? "desc" : "asc");
    setPage(1);
  };
  /** A schedule opens on a page of its own. */
  const edit = (id: string) => navigate(`/report/scheduled/${id}`);
  const scheduleColumns: DataTableColumn<ReportSchedule>[] = [
                {
                  id: "no",
                  header: "No.",
                  cell: (_r, i) => (page - 1) * 10 + i + 1,
                },
                {
                  id: "name",
                  header: "Schedule name",
                  sort: {
                    direction: sort === "name" ? direction : undefined,
                    onSort: () => sortBy("name"),
                  },
                  cell: (r) => (
                    <button
                      type="button"
                      disabled={!canManage}
                      className="max-w-72 whitespace-normal font-medium text-emerald-600 hover:underline text-left disabled:text-slate-700 disabled:no-underline"
                      onClick={() => void edit(r.id)}
                    >
                      {r.name}
                    </button>
                  ),
                },
                {
                  id: "owner",
                  header: "Owner",
                  cell: (r) => r.ownerName ?? "—",
                },
                {
                  id: "template",
                  header: "Template",
                  cell: (r) => r.definitionCode,
                },
                {
                  id: "cron",
                  header: "Schedule",
                  cell: (r) => r.cronExpression,
                },
                {
                  id: "status",
                  header: "Status",
                  sort: {
                    direction: sort === "status" ? direction : undefined,
                    onSort: () => sortBy("status"),
                  },
                  cell: (r) => (
                    <Badge color={r.active ? "emerald" : "slate"}>
                      {scheduleStatusLabel(r.status)}
                    </Badge>
                  ),
                },
                {
                  id: "next",
                  header: "Next run",
                  sort: {
                    direction: sort === "nextRunAt" ? direction : undefined,
                    onSort: () => sortBy("nextRunAt"),
                  },
                  cell: (r) =>
                    r.nextRunAt ? new Date(r.nextRunAt).toLocaleString() : "—",
                },
  ];
  const scheduleAction: DataTableAction<ReportSchedule> = {
                cell: (r) =>
                  canManage ? (
                    <button
                      type="button"
                      ref={menu.getRef(r.id)}
                      aria-label="More actions"
                      className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                      onClick={(event) => menu.toggle(r.id, event)}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  ) : (
                    "—"
                  ),
  };
  const { layout: scheduleLayout, control: scheduleControl } = useCustomColumnLayout("reportSchedules", scheduleColumns, scheduleAction);

  return (
    <div className="flex min-w-0 flex-col h-full gap-4 md:gap-6 w-full flex-1">
      <PageHeader
        title="Scheduled Reports"
        breadcrumbItems={reportBreadcrumbs(navigate, "Scheduled Reports")}
        actions={
          canManage ? (
            <Button
              size="sm"
              onClick={() => navigate("/report/scheduled/new")}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Schedule
            </Button>
          ) : undefined
        }
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-700">
          {notice}
        </p>
      )}
      <ReportListToolbar
            searchPlaceholder="Search schedule name…"
            search={input}
            onSearch={setInput}
            filters={[
              {
                id: "status",
                label: "Status",
                value: status,
                options: [
                  { label: "All", value: "" },
                  { label: "Active", value: "ACTIVE" },
                  { label: "Paused", value: "PAUSED" },
                  { label: "Authorization changed", value: "SUSPENDED_AUTHORIZATION_CHANGED" },
                  { label: "Invalid schedule", value: "SUSPENDED_INVALID_SCHEDULE" },
                  { label: "Template not approved", value: "SUSPENDED_TEMPLATE_NOT_APPROVED" },
                  { label: "Template disabled", value: "SUSPENDED_TEMPLATE_DISABLED" },
                ],
                onChange: (value) => {
                  setStatus(value);
                  setPage(1);
                },
              },
            ]}
            hasActiveFilters={!!status}
            onClear={() => {
              setStatus("");
              setPage(1);
            }}
            customControl={scheduleControl}
          >
          <div className="flex-1 flex flex-col relative">
            <DataTable
              rows={data.data}
              getRowKey={(r) => r.id}
              isLoading={busy}
              loadingContent={
                <SectionLoading text="Loading report schedules…" />
              }
              emptyState={
                <TableEmptyState
                  title="No Scheduled Reports Found"
                  description="Create a schedule to generate reports automatically, or change your filters."
                />
              }
              scrollerRef={drag.scrollerRef}
              scrollProps={drag.dragEvents}
              isDragging={drag.isDragging}
              columns={scheduleColumns}
              columnLayout={scheduleLayout}
              action={scheduleAction}
              pagination={
                <TablePagination
                  currentPage={page}
                  totalPages={data.pagination.totalPages}
                  totalItems={data.pagination.total}
                  itemsPerPage={10}
                  showItemsPerPageSelector={false}
                  onPageChange={setPage}
                />
              }
            />
          </div>
      </ReportListToolbar>
      <PortalDropdownMenu
        isOpen={canManage && !!menu.openId}
        onClose={menu.close}
        position={menu.position}
        minWidth={200}
      >
        {data.data
          .filter((row) => row.id === menu.openId)
          .map((row) => (
            <div className="py-1" key={row.id}>
              <DropdownMenuItem
                icon={<IconPencilMinus className="h-4 w-4" />}
                onClick={() => {
                  void edit(row.id);
                  menu.close();
                }}
              >
                Edit Schedule
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<IconReplaceUser className="h-4 w-4" />}
                onClick={() => {
                  menu.close();
                  void openOwnerChange(row);
                }}
              >
                Change Owner
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={
                  row.active ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )
                }
                onClick={async () => {
                  menu.close();
                  try {
                    if (row.active) await reportsApi.pauseSchedule(row.id);
                    else await reportsApi.resumeSchedule(row.id);
                    setRefresh((n) => n + 1);
                  } catch (e) {
                    setError(reportError(e));
                  }
                }}
              >
                {row.active ? "Pause Schedule" : "Resume Schedule"}
              </DropdownMenuItem>
            </div>
          ))}
      </PortalDropdownMenu>
      <FormModal
        isOpen={!!ownerChange}
        onClose={() => {
          if (!ownerChange?.busy) setOwnerChange(undefined);
        }}
        title="Change schedule owner"
        description={`The owner of "${ownerChange?.name ?? ""}" is told when the schedule stops. Owning it does not give the right to change or run it; that stays with the creator.`}
        confirmText="Change owner"
        confirmDisabled={
          !ownerChange?.ownerUserId || !ownerChange.reason.trim() || ownerChange.busy
        }
        onConfirm={() => void saveOwner()}
      >
        <div className="space-y-4">
          <Select
            label="New owner"
            value={ownerChange?.ownerUserId ?? ""}
            placeholder="Select a person"
            options={(ownerChange?.options ?? []).map((c) => ({
              value: c.id,
              label: c.fullName,
            }))}
            onChange={(value) => patchOwner({ ownerUserId: String(value) })}
          />
          <FormField label="Reason" required>
            <Textarea
              rows={3}
              maxLength={1000}
              value={ownerChange?.reason ?? ""}
              onChange={(e) => patchOwner({ reason: e.target.value })}
            />
          </FormField>
          {ownerChange?.error && (
            <p role="alert" className="text-sm text-red-600">
              {ownerChange.error}
            </p>
          )}
        </div>
      </FormModal>
    </div>
  );
}
