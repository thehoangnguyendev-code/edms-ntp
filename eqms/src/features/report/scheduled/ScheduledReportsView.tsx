import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormSection } from "@/components/ui/form/FormSection";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Drawer } from "@/components/ui/drawer/Drawer";
import { DataTable } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Pencil, Pause, Play } from "lucide-react";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { ReportListFilters } from "../shared/ReportListFilters";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { usePermissions } from "@/hooks/usePermissions";
import {
  reportsApi,
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

const inputClass =
  "mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm";
const blank = (): ReportScheduleDetail => ({
  id: "",
  version: 1,
  name: "",
  definitionCode: "",
  cronExpression: "0 0 8 * * MON-FRI",
  format: "PDF",
  recipientUserIds: [],
  parameters: {},
  fields: [],
});
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
  const [catalog, setCatalog] = useState<ReportTemplate[]>([]);
  const [draft, setDraft] = useState<ReportScheduleDetail>();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [recipientInput, setRecipientInput] = useState("");
  const [candidates, setCandidates] = useState<ReportRecipientCandidate[]>([]);
  const [editError, setEditError] = useState("");
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
  useEffect(() => {
    let alive = true;
    reportsApi
      .catalog()
      .then((v) => {
        if (alive) setCatalog(v as ReportTemplate[]);
      })
      .catch((e) => {
        if (alive) setError(reportError(e));
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!draft) return;
    let alive = true;
    const timer = setTimeout(() => {
      reportsApi
        .listScheduleRecipients(recipientInput)
        .then((v) => {
          if (alive) setCandidates(v);
        })
        .catch((e) => {
          if (alive) setEditError(reportError(e));
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [recipientInput, !!draft]);
  const patch = (p: Partial<ReportScheduleDetail>) =>
    setDraft((v) => (v ? { ...v, ...p } : v));
  const template = catalog.find((t) => t.code === draft?.definitionCode);
  const sortBy = (field: string) => {
    setSort(field);
    setDirection(sort === field && direction === "asc" ? "desc" : "asc");
    setPage(1);
  };
  const edit = async (id: string) => {
    setEditError("");
    setReason("");
    try {
      setDraft(await reportsApi.scheduleDetail(id));
    } catch (e) {
      setError(reportError(e));
    }
  };
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setEditError("");
    try {
      if (draft.id)
        await reportsApi.updateSchedule(draft.id, draft.version, draft, reason);
      else await reportsApi.createSchedule(draft);
      setDraft(undefined);
      setNotice("Schedule saved. Changes apply to future occurrences.");
      setRefresh((n) => n + 1);
    } catch (e) {
      setEditError(reportError(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex min-w-0 flex-col h-full gap-4 md:gap-6 w-full flex-1">
      <PageHeader
        title="Scheduled Reports"
        breadcrumbItems={reportBreadcrumbs(navigate, "Scheduled Reports")}
        actions={
          canManage ? (
            <Button
              size="sm"
              onClick={() => {
                setDraft(blank());
                setEditError("");
                setReason("");
                setRecipientInput("");
              }}
            >
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm min-w-0 w-full overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          <ReportListFilters
            search={input}
            onSearch={setInput}
            placeholder="Search schedule name…"
            values={{ status }}
            defaults={{ status: "" }}
            groups={[
              {
                id: "status",
                label: "Status",
                options: [
                  { value: "", label: "All statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "PAUSED", label: "Paused" },
                  {
                    value: "SUSPENDED_AUTHORIZATION_CHANGED",
                    label: "Authorization changed",
                  },
                  {
                    value: "SUSPENDED_INVALID_SCHEDULE",
                    label: "Invalid schedule",
                  },
                ],
              },
            ]}
            onApply={(next) => {
              setStatus(next.status);
              setPage(1);
            }}
          />
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
              columns={[
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
                      {r.status}
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
              ]}
              action={{
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
              }}
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
        </div>
      </div>
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
                icon={<Pencil className="h-4 w-4" />}
                onClick={() => {
                  void edit(row.id);
                  menu.close();
                }}
              >
                Edit Schedule
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
      <Drawer
        open={!!draft}
        title={draft?.id ? "Edit Report Schedule" : "New Report Schedule"}
        onClose={() => {
          if (!saving) setDraft(undefined);
        }}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => setDraft(undefined)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              loading={saving}
              disabled={
                !draft?.name.trim() ||
                !draft.definitionCode ||
                (!!draft.id && !reason.trim())
              }
              onClick={() => void save()}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        {draft && (
          <fieldset disabled={saving} className="space-y-5">
            {editError && (
              <p role="alert" className="text-sm text-red-700">
                {editError}
              </p>
            )}
            <FormSection title="Schedule Information">
              <div className="space-y-4">
                <label className="block text-sm text-slate-700">
                  Schedule name <span className="text-red-600">*</span>
                  <Input
                    className={inputClass}
                    maxLength={255}
                    value={draft.name}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </label>
                <Select
                  label="Report template"
                  value={draft.definitionCode}
                  disabled={!!draft.id}
                  options={catalog.map((t) => ({
                    value: t.code,
                    label: t.displayName,
                  }))}
                  onChange={(code) => {
                    const t = catalog.find((t) => t.code === String(code));
                    patch({
                      definitionCode: String(code),
                      format: t?.allowedFormats[0] ?? "PDF",
                      parameters: {},
                      fields:
                        t?.fields
                          .filter(
                            (f) =>
                              f.allowed &&
                              (f.required ||
                                f.defaultSelected ||
                                t.layout?.charts?.some(
                                  (c) => c.field === f.code,
                                )),
                          )
                          .map((f) => f.code) ?? [],
                    });
                  }}
                />
                <label className="block text-sm text-slate-700">
                  Report name (optional)
                  <Input
                    className={inputClass}
                    maxLength={255}
                    value={String(draft.parameters?.reportTitle ?? "")}
                    placeholder={template?.displayName}
                    onChange={(e) => {
                      const params = { ...draft.parameters };
                      if (e.target.value) params.reportTitle = e.target.value;
                      else delete params.reportTitle;
                      patch({ parameters: params });
                    }}
                  />
                </label>
              </div>
            </FormSection>
            <FormSection title="Frequency & Output">
              <div className="space-y-4">
                <Select
                  label="Frequency"
                  value={
                    [
                      "0 0 8 * * *",
                      "0 0 8 * * MON-FRI",
                      "0 0 8 * * MON",
                      "0 0 8 1 * *",
                    ].includes(draft.cronExpression)
                      ? draft.cronExpression
                      : "custom"
                  }
                  options={[
                    { value: "0 0 8 * * *", label: "Daily · 08:00" },
                    { value: "0 0 8 * * MON-FRI", label: "Weekdays · 08:00" },
                    { value: "0 0 8 * * MON", label: "Weekly · Monday 08:00" },
                    { value: "0 0 8 1 * *", label: "Monthly · day 1 at 08:00" },
                    { value: "custom", label: "Custom cron" },
                  ]}
                  enableSearch={false}
                  onChange={(v) =>
                    patch({
                      cronExpression:
                        v === "custom" ? "0 30 8 * * *" : String(v),
                    })
                  }
                />
                <label className="block text-sm text-slate-700">
                  Cron expression
                  <Input
                    className={inputClass}
                    value={draft.cronExpression}
                    onChange={(e) => patch({ cronExpression: e.target.value })}
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Server time zone. Six fields: second, minute, hour, day,
                    month, weekday.
                  </span>
                </label>
                <Select
                  label="Output format"
                  value={draft.format}
                  options={(template?.allowedFormats ?? [draft.format]).map(
                    (v) => ({ value: v, label: v }),
                  )}
                  enableSearch={false}
                  onChange={(v) => patch({ format: v as ReportFormat })}
                />
              </div>
            </FormSection>
            <FormSection title="Criteria & Columns">
              <div className="space-y-4">
                {!template && (
                  <p className="text-sm text-slate-500">
                    Choose a report template to configure its criteria and
                    columns.
                  </p>
                )}
                {template?.filterFields?.map((f) =>
                  f.type === "LOOKUP" ? (
                    <ReportLookup
                      key={f.code}
                      code={template.code}
                      field={f.code}
                      label={f.name}
                      value={String(draft.parameters?.[f.code] ?? "")}
                      onChange={(v) =>
                        patch({
                          parameters: { ...draft.parameters, [f.code]: v },
                        })
                      }
                    />
                  ) : f.type === "DATE" ? (
                    <DateTimePicker
                      key={f.code}
                      label={f.name}
                      showTime={false}
                      value={String(draft.parameters?.[f.code] ?? "")}
                      onChange={(v) => {
                        const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                        patch({
                          parameters: {
                            ...draft.parameters,
                            [f.code]: m ? `${m[3]}-${m[2]}-${m[1]}` : v,
                          },
                        });
                      }}
                    />
                  ) : (
                    <label key={f.code} className="block text-sm">
                      {f.name}
                      <Input
                        className={inputClass}
                        value={String(draft.parameters?.[f.code] ?? "")}
                        onChange={(e) =>
                          patch({
                            parameters: {
                              ...draft.parameters,
                              [f.code]: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ),
                )}
                <div className="space-y-3">
                  {template?.fields
                    .filter((f) => f.allowed)
                    .map((f) => (
                      <Checkbox
                        key={f.code}
                        label={f.name}
                        checked={draft.fields?.includes(f.code) ?? false}
                        disabled={
                          f.required ||
                          template.layout?.charts?.some(
                            (c) => c.field === f.code,
                          )
                        }
                        onChange={(on) =>
                          patch({
                            fields: on
                              ? [...(draft.fields ?? []), f.code]
                              : (draft.fields ?? []).filter(
                                  (c) => c !== f.code,
                                ),
                          })
                        }
                      />
                    ))}
                </div>
              </div>
            </FormSection>
            <FormSection
              title={`Recipients · ${draft.recipientUserIds?.length ?? 0} selected`}
            >
              <div className="space-y-4">
                {!!draft.recipientUserIds?.length && (
                  <ul className="space-y-2">
                    {draft.recipientUserIds.map((id) => (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 break-words">
                          {draft.recipients?.find((r) => r.id === id)
                            ?.fullName ??
                            candidates.find((c) => c.id === id)?.fullName ??
                            id}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            patch({
                              recipientUserIds: draft.recipientUserIds?.filter(
                                (uid) => uid !== id,
                              ),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <SearchInput
                  value={recipientInput}
                  onChange={setRecipientInput}
                  placeholder="Search active authorized users…"
                />
                <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
                  {candidates.map((c) => (
                    <Checkbox
                      key={c.id}
                      label={`${c.fullName} · ${c.employeeCode ?? c.email}`}
                      checked={draft.recipientUserIds?.includes(c.id) ?? false}
                      onChange={(on) =>
                        patch({
                          recipientUserIds: on
                            ? [...(draft.recipientUserIds ?? []), c.id]
                            : (draft.recipientUserIds ?? []).filter(
                                (id) => id !== c.id,
                              ),
                          recipients: on
                            ? [
                                ...(draft.recipients ?? []).filter(
                                  (r) => r.id !== c.id,
                                ),
                                { id: c.id, fullName: c.fullName },
                              ]
                            : draft.recipients?.filter((r) => r.id !== c.id),
                        })
                      }
                    />
                  ))}
                  {!candidates.length && (
                    <p className="text-sm text-slate-500">
                      No eligible recipients found.
                    </p>
                  )}
                </div>
              </div>
            </FormSection>
            {draft.id && (
              <label className="block text-sm">
                Change reason <span className="text-red-600">*</span>
                <Textarea
                  className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm"
                  rows={2}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
          </fieldset>
        )}
      </Drawer>
    </div>
  );
}
