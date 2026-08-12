import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowUpDown, CalendarClock, Download, Eye, FileBarChart, History, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { Button } from "@/components/ui/button/Button";
import { reportsApi, type ReportDefinition, type ReportFormat, type ReportRecipientCandidate, type ReportRunPage, type ReportSchedule } from "@/services/api/reports";

const tabs = [
  { id: "templates", label: "Report Templates", icon: FileBarChart },
  { id: "history", label: "Report History", icon: History },
  { id: "scheduled", label: "Scheduled Reports", icon: CalendarClock },
] as const;
type TabId = (typeof tabs)[number]["id"];
type HistorySort = "queuedAt" | "completedAt" | "definitionCode" | "status";
const emptyPage: ReportRunPage = { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };

function parseFormats(value: unknown): ReportFormat[] {
  if (Array.isArray(value)) return value as ReportFormat[];
  if (typeof value !== "string") return ["CSV"];
  try { return JSON.parse(value) as ReportFormat[]; } catch { return ["CSV"]; }
}

function SortableHeader({ label, column, current, direction, onSort }: { label: string; column: HistorySort; current: HistorySort; direction: "asc" | "desc"; onSort: (column: HistorySort) => void }) {
  return <th className="px-4 py-3 text-left"><button type="button" onClick={() => onSort(column)} className="ml-auto flex items-center gap-1 font-semibold uppercase hover:text-emerald-700">{label}<ArrowUpDown className={`h-3.5 w-3.5 ${current === column ? "text-emerald-600" : "text-slate-400"}`} aria-label={`Sort by ${label} ${current === column ? direction : ""}`} /></button></th>;
}

export function ReportView() {
  const { tab } = useParams<{ tab: TabId }>();
  const navigate = useNavigate();
  const active = tabs.some((item) => item.id === tab) ? tab! : "templates";
  const [catalog, setCatalog] = useState<ReportDefinition[]>([]);
  const [selected, setSelected] = useState<ReportDefinition | null>(null);
  const [format, setFormat] = useState<ReportFormat>("CSV");
  const [templateSearch, setTemplateSearch] = useState("");
  const [historySearchInput, setHistorySearchInput] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [history, setHistory] = useState<ReportRunPage>(emptyPage);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [historySort, setHistorySort] = useState<HistorySort>("queuedAt");
  const [historyDirection, setHistoryDirection] = useState<"asc" | "desc">("desc");
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleDefinitionCode, setScheduleDefinitionCode] = useState("");
  const [scheduleCron, setScheduleCron] = useState("0 0 8 * * MON-FRI");
  const [scheduleFormat, setScheduleFormat] = useState<ReportFormat>("CSV");
  const [recipientSearchInput, setRecipientSearchInput] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientCandidates, setRecipientCandidates] = useState<ReportRecipientCandidate[]>([]);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewRows, setPreviewRows] = useState<string[][] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let activeRequest = true;
    reportsApi.catalog()
      .then((data) => { if (activeRequest) { setCatalog(data); setSelected((current) => current ?? data.find((definition) => definition.active) ?? null); } })
      .catch(() => activeRequest && setMessage("Unable to load the report catalog."))
      .finally(() => activeRequest && setLoadingCatalog(false));
    return () => { activeRequest = false; };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { setHistorySearch(historySearchInput); setHistoryPage(1); }, 300);
    return () => window.clearTimeout(timeout);
  }, [historySearchInput]);

  useEffect(() => {
    if (active !== "history") return;
    let activeRequest = true;
    setLoadingHistory(true);
    reportsApi.listRuns({ search: historySearch, page: historyPage, limit: historyLimit, sortBy: historySort, sortDirection: historyDirection })
      .then((response) => activeRequest && setHistory(response))
      .catch(() => activeRequest && setMessage("Unable to load report history."))
      .finally(() => activeRequest && setLoadingHistory(false));
    return () => { activeRequest = false; };
  }, [active, historyDirection, historyLimit, historyPage, historySearch, historySort]);

  const loadSchedules = () => {
    setLoadingSchedules(true);
    return reportsApi.listSchedules().then(setSchedules).catch(() => setMessage("Unable to load scheduled reports.")).finally(() => setLoadingSchedules(false));
  };
  useEffect(() => { if (active === "scheduled") void loadSchedules(); }, [active]);
  useEffect(() => {
    const timeout = window.setTimeout(() => setRecipientSearch(recipientSearchInput), 300);
    return () => window.clearTimeout(timeout);
  }, [recipientSearchInput]);
  useEffect(() => {
    if (active !== "scheduled") return;
    let activeRequest = true;
    reportsApi.listScheduleRecipients(recipientSearch).then((items) => activeRequest && setRecipientCandidates(items)).catch(() => activeRequest && setMessage("Unable to load eligible recipients."));
    return () => { activeRequest = false; };
  }, [active, recipientSearch]);

  const visible = useMemo(() => catalog.filter((definition) => definition.displayName.toLowerCase().includes(templateSearch.toLowerCase()) || definition.code.toLowerCase().includes(templateSearch.toLowerCase())), [catalog, templateSearch]);
  if (!tab || !tabs.some((item) => item.id === tab)) return <Navigate to="/report/templates" replace />;

  const generate = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const response = await reportsApi.createRun({ definitionCode: selected.code, format, fields: selected.fields?.filter((field) => field.defaultSelected || field.required).map((field) => field.code) }, crypto.randomUUID());
      setMessage(`Report queued: ${response.id}`);
      navigate("/report/history");
    } catch { setMessage("Report generation could not be queued."); } finally { setSubmitting(false); }
  };
  const preview = async () => {
    if (!selected) return;
    setPreviewing(true);
    try {
      const response = await reportsApi.previewDefinition(selected.code, selected.fields?.filter((field) => field.defaultSelected || field.required).map((field) => field.code));
      setPreviewRows(response.rows);
    } catch { setMessage("Report preview could not be loaded."); } finally { setPreviewing(false); }
  };

  const download = async (runId: string, artifactId: string) => {
    try {
      const blob = await reportsApi.downloadArtifact(runId, artifactId);
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "report"; anchor.click(); URL.revokeObjectURL(url);
    } catch { setMessage("Report download is no longer authorized or the artifact has expired."); }
  };
  const retry = async (runId: string) => {
    try { await reportsApi.retryRun(runId); setMessage("Report retry queued."); if (active === "history") { setHistoryPage(1); } }
    catch { setMessage("Report retry could not be requested."); }
  };

  const changeSort = (column: HistorySort) => {
    if (column === historySort) setHistoryDirection((current) => current === "asc" ? "desc" : "asc");
    else { setHistorySort(column); setHistoryDirection("asc"); }
    setHistoryPage(1);
  };
  const createSchedule = async () => {
    if (!scheduleName.trim() || !scheduleDefinitionCode) return;
    setSubmitting(true);
    try {
      await reportsApi.createSchedule({ name: scheduleName.trim(), definitionCode: scheduleDefinitionCode, cronExpression: scheduleCron.trim(), format: scheduleFormat, recipientUserIds: recipientIds });
      setScheduleName(""); setRecipientIds([]); setMessage("Scheduled report created."); await loadSchedules();
    } catch { setMessage("Scheduled report could not be created. Check the schedule and permissions."); } finally { setSubmitting(false); }
  };
  const changeScheduleState = async (schedule: ReportSchedule) => {
    try { if (schedule.active) await reportsApi.pauseSchedule(schedule.id); else await reportsApi.resumeSchedule(schedule.id); await loadSchedules(); }
    catch { setMessage("Scheduled report could not be updated."); }
  };

  return <div className="flex min-h-0 flex-1 flex-col gap-5">
    <PageHeader title="Reports & Analytics" breadcrumbItems={[{ label: "Reports & Analytics" }]} />
    {message && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
    <FormSection title="Report Workspace" description="Report data is scoped and generated asynchronously as immutable snapshots." icon={<FileBarChart className="h-4 w-4" />}>
      <TabNav tabs={tabs} activeTab={active} onChange={(id) => navigate(`/report/${id}`)} variant="underline" ariaLabel="Report workspace sections" />
      {active === "templates" && <><div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]"><div><label className="mb-1 block text-sm font-medium text-slate-700">Search</label><SearchInput value={templateSearch} onChange={setTemplateSearch} placeholder="Search report templates..." /><div className="mt-4 grid gap-3 sm:grid-cols-2">{loadingCatalog ? <p className="text-sm text-slate-500">Loading catalog...</p> : visible.map((definition) => <button type="button" key={definition.code} onClick={() => { setSelected(definition); setFormat(parseFormats(definition.allowedFormats)[0] ?? "CSV"); }} className={`rounded-xl border p-4 text-left transition-colors ${selected?.code === definition.code ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}><p className="font-semibold text-slate-900">{definition.displayName}</p><p className="mt-1 line-clamp-2 text-sm text-slate-500">{definition.description}</p><p className="mt-3 font-mono text-xs text-slate-400">{definition.code}</p>{!definition.active && <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Disabled</span>}</button>)}</div></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold text-slate-900">Generate report</h3>{selected ? <><p className="mt-2 text-sm text-slate-600">{selected.displayName}</p><label className="mt-4 block text-sm font-medium text-slate-700">Format<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)}>{parseFormats(selected.allowedFormats).map((item) => <option key={item}>{item}</option>)}</select></label><p className="mt-4 text-xs text-slate-500">Preview is limited, server-scoped and never creates an official artifact.</p><div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!selected.active || previewing} onClick={preview}><Eye className="h-4 w-4" />{previewing ? "Loading..." : "Preview"}</Button><Button size="sm" disabled={!selected.active || submitting} onClick={generate}><Play className="h-4 w-4" />{submitting ? "Queueing..." : "Generate Report"}</Button></div></> : <p className="mt-3 text-sm text-slate-500">Select a report definition.</p>}</div></div>{previewRows && <div className="mt-5 overflow-hidden rounded-xl border border-slate-200"><div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><p className="text-sm font-semibold text-slate-800">Server-scoped preview</p><Button variant="ghost" size="sm" onClick={() => setPreviewRows(null)}>Close</Button></div><div className="max-h-80 overflow-auto"><table className="w-full min-w-max text-sm"><tbody>{previewRows.map((row, index) => <tr key={index} className="border-b border-slate-100 last:border-b-0">{row.map((cell, cellIndex) => index === 0 ? <th key={cellIndex} className="bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">{cell}</th> : <td key={cellIndex} className="px-3 py-2 text-slate-700">{cell}</td>)}</tr>)}</tbody></table></div></div>}</>}
      {active === "history" && <div className="mt-5"><label className="mb-1 block text-sm font-medium text-slate-700">Search</label><SearchInput value={historySearchInput} onChange={setHistorySearchInput} placeholder="Search report runs..." /><div className="mt-4 overflow-hidden rounded-xl border border-slate-200"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><SortableHeader label="Definition" column="definitionCode" current={historySort} direction={historyDirection} onSort={changeSort} /><SortableHeader label="Status" column="status" current={historySort} direction={historyDirection} onSort={changeSort} /><SortableHeader label="Queued" column="queuedAt" current={historySort} direction={historyDirection} onSort={changeSort} /><th className="px-4 py-3 text-left font-semibold uppercase">Reason</th><th className="px-4 py-3 text-left font-semibold uppercase">Action</th></tr></thead><tbody>{history.data.map((run) => <tr key={run.id} className="border-t border-slate-100"><td className="px-4 py-3 font-mono text-xs">{run.definitionCode}</td><td className="px-4 py-3">{run.status}</td><td className="px-4 py-3">{run.queuedAt ?? "—"}</td><td className="px-4 py-3 text-slate-500">{run.reasonCode ?? "—"}</td><td className="px-4 py-3"><div className="flex gap-2"><Button variant="outline" size="sm" disabled={run.status !== "COMPLETED" || !run.artifactId} onClick={() => download(run.id, run.artifactId!)}><Download className="h-4 w-4" />Download</Button>{["FAILED", "RETRY_SCHEDULED"].includes(run.status) && <Button variant="outline" size="sm" onClick={() => retry(run.id)}>Retry</Button>}</div></td></tr>)}{!loadingHistory && history.data.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No report runs found.</td></tr>}</tbody></table></div>{loadingHistory && <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">Loading report history...</div>}<TablePagination currentPage={history.pagination.page} totalPages={history.pagination.totalPages} totalItems={history.pagination.total} itemsPerPage={history.pagination.limit} isLoading={loadingHistory} onPageChange={setHistoryPage} onItemsPerPageChange={setHistoryLimit} /></div></div>}
      {active === "scheduled" && <div className="mt-5 space-y-5"><div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4"><label className="text-sm font-medium text-slate-700">Schedule name<input value={scheduleName} onChange={(event) => setScheduleName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Monthly document status" /></label><label className="text-sm font-medium text-slate-700">Report definition<select value={scheduleDefinitionCode} onChange={(event) => { const definition = catalog.find((item) => item.code === event.target.value); setScheduleDefinitionCode(event.target.value); setScheduleFormat(definition ? parseFormats(definition.allowedFormats)[0] ?? "CSV" : "CSV"); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Select report...</option>{catalog.filter((definition) => definition.active).map((definition) => <option key={definition.code} value={definition.code}>{definition.displayName}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Cron schedule<input value={scheduleCron} onChange={(event) => setScheduleCron(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm" aria-describedby="cron-help" /><span id="cron-help" className="mt-1 block text-xs font-normal text-slate-500">Six fields: second minute hour day month weekday.</span></label><div className="flex items-end"><Button className="w-full" disabled={submitting || !scheduleName.trim() || !scheduleDefinitionCode} onClick={createSchedule}><CalendarClock className="h-4 w-4" />Create schedule</Button></div></div><div className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_20rem]"><div><label className="mb-1 block text-sm font-medium text-slate-700">Recipients</label><SearchInput value={recipientSearchInput} onChange={setRecipientSearchInput} placeholder="Search active users eligible to download..." /><p className="mt-1 text-xs text-slate-500">Only active internal users who currently have download permission can be selected.</p></div><div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">{recipientCandidates.map((candidate) => <label key={candidate.id} className="flex cursor-pointer items-start gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0"><input type="checkbox" checked={recipientIds.includes(candidate.id)} onChange={() => setRecipientIds((current) => current.includes(candidate.id) ? current.filter((id) => id !== candidate.id) : [...current, candidate.id])} className="mt-1 h-4 w-4 accent-emerald-600" /><span><span className="block text-sm font-medium text-slate-800">{candidate.fullName}</span><span className="block text-xs text-slate-500">{candidate.employeeCode ?? candidate.email} · {candidate.department ?? "—"}</span></span></label>)}{recipientCandidates.length === 0 && <p className="px-3 py-4 text-xs text-slate-500">No eligible recipients found.</p>}</div></div><div className="overflow-hidden rounded-xl border border-slate-200"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Definition</th><th className="px-4 py-3">Schedule</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Next run</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{schedules.map((schedule) => <tr key={schedule.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{schedule.name}</td><td className="px-4 py-3 font-mono text-xs">{schedule.definitionCode}</td><td className="px-4 py-3 font-mono text-xs">{schedule.cronExpression}</td><td className="px-4 py-3">{schedule.status}</td><td className="px-4 py-3">{schedule.nextRunAt ?? "—"}</td><td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => changeScheduleState(schedule)}>{schedule.active ? "Pause" : "Resume"}</Button></td></tr>)}{!loadingSchedules && schedules.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No scheduled reports found.</td></tr>}</tbody></table></div>{loadingSchedules && <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">Loading schedules...</div>}</div></div>}
    </FormSection>
  </div>;
}
