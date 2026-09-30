import { useEffect, useLayoutEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpDown, Download, History } from "lucide-react";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { Button } from "@/components/ui/button/Button";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { reportsApi, type ReportRunPage } from "@/services/api/reports";
import { ReportPageSection } from "../shared/ReportPageSection";
import { TableMarkup } from "@/components/ui/table/TablePrimitives";

type Sort = "queuedAt" | "completedAt" | "definitionCode" | "status";
const EMPTY: ReportRunPage = { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };

function Header({ label, column, current, direction, onSort }: { label: string; column: Sort; current: Sort; direction: "asc" | "desc"; onSort: (column: Sort) => void }) {
  return <TableMarkup.HeaderCell className="px-4 py-3 text-left"><button type="button" onClick={() => onSort(column)} className="ml-auto flex items-center gap-1 font-semibold uppercase hover:text-emerald-700">{label}<ArrowUpDown className={`h-3.5 w-3.5 ${current === column ? "text-emerald-600" : "text-slate-400"}`} aria-label={`Sort by ${label} ${current === column ? direction : ""}`} /></button></TableMarkup.HeaderCell>;
}

export function ReportHistoryView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState(() => searchParams.get("search") ?? ""); const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get("page")) || 1)); const [limit, setLimit] = useState(() => Number(searchParams.get("limit")) || 20);
  const [sort, setSort] = useState<Sort>(() => (searchParams.get("sortBy") as Sort) || "queuedAt"); const [direction, setDirection] = useState<"asc" | "desc">(() => searchParams.get("sortDirection") === "asc" ? "asc" : "desc");
  const [history, setHistory] = useState<ReportRunPage>(EMPTY); const [loading, setLoading] = useState(false); const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(input); setPage(1); }, 300); return () => window.clearTimeout(timer); }, [input]);
  useLayoutEffect(() => {
    const value = searchParams.get("search") ?? "";
    setInput(value); setSearch(value); setPage(Math.max(1, Number(searchParams.get("page")) || 1)); setLimit(Number(searchParams.get("limit")) || 20);
    setSort((searchParams.get("sortBy") as Sort) || "queuedAt"); setDirection(searchParams.get("sortDirection") === "asc" ? "asc" : "desc");
  }, [searchParams]);
  useEffect(() => {
    if (input !== search) return;
    const params = new URLSearchParams();
    if (search) params.set("search", search); if (page > 1) params.set("page", String(page)); if (limit !== 20) params.set("limit", String(limit)); if (sort !== "queuedAt") params.set("sortBy", sort); if (direction !== "desc") params.set("sortDirection", direction);
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [input, search, page, limit, sort, direction, searchParams, setSearchParams]);
  useEffect(() => { let current = true; setLoading(true); reportsApi.listRuns({ search, page, limit, sortBy: sort, sortDirection: direction }).then((response) => current && setHistory(response)).catch(() => current && setNotice("Unable to load report history.")).finally(() => current && setLoading(false)); return () => { current = false; }; }, [direction, limit, page, search, sort]);
  const changeSort = (column: Sort) => { if (column === sort) setDirection((value) => value === "asc" ? "desc" : "asc"); else { setSort(column); setDirection("asc"); } setPage(1); };
  const download = async (runId: string, artifactId: string) => { try { const blob = await reportsApi.downloadArtifact(runId, artifactId); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "report"; link.click(); URL.revokeObjectURL(url); } catch { setNotice("Report download is no longer authorized or the artifact has expired."); } };
  const retry = async (runId: string) => { try { await reportsApi.retryRun(runId); setNotice("Report retry queued."); setPage(1); } catch { setNotice("Report retry could not be requested."); } };
  return <ReportPageSection title="Report History" sectionTitle="Generated report history" description="Review report snapshots, their processing status, and available download or retry actions." icon={History} notice={notice}><label className="mb-1 block text-sm font-medium text-slate-700">Search</label><SearchInput value={input} onChange={setInput} placeholder="Search report runs..." /><div className="mt-4 overflow-hidden rounded-xl border border-slate-200"><div className="overflow-x-auto"><TableMarkup.Root className="w-full min-w-[760px] text-sm"><TableMarkup.Head className="bg-slate-50 text-xs text-slate-500"><TableMarkup.Row><Header label="Definition" column="definitionCode" current={sort} direction={direction} onSort={changeSort} /><Header label="Status" column="status" current={sort} direction={direction} onSort={changeSort} /><Header label="Queued" column="queuedAt" current={sort} direction={direction} onSort={changeSort} /><TableMarkup.HeaderCell className="px-4 py-3 text-left font-semibold uppercase">Reason</TableMarkup.HeaderCell><TableMarkup.HeaderCell className="px-4 py-3 text-left font-semibold uppercase">Action</TableMarkup.HeaderCell></TableMarkup.Row></TableMarkup.Head><TableMarkup.Body>{history.data.map((run) => <TableMarkup.Row key={run.id} className="border-t border-slate-100"><TableMarkup.Cell className="px-4 py-3 font-mono text-xs">{run.definitionCode}</TableMarkup.Cell><TableMarkup.Cell className="px-4 py-3">{run.status}</TableMarkup.Cell><TableMarkup.Cell className="px-4 py-3">{run.queuedAt ?? "—"}</TableMarkup.Cell><TableMarkup.Cell className="px-4 py-3 text-slate-500">{run.reasonCode ?? "—"}</TableMarkup.Cell><TableMarkup.Cell className="px-4 py-3"><div className="flex gap-2"><Button variant="outline" size="sm" disabled={run.status !== "COMPLETED" || !run.artifactId} onClick={() => download(run.id, run.artifactId!)}><Download className="h-4 w-4" />Download</Button>{["FAILED", "RETRY_SCHEDULED"].includes(run.status) && <Button variant="outline" size="sm" onClick={() => retry(run.id)}>Retry</Button>}</div></TableMarkup.Cell></TableMarkup.Row>)}{!loading && history.data.length === 0 && <TableMarkup.Row><TableMarkup.Cell colSpan={5} className="p-0"><TableEmptyState title="No report runs found." /></TableMarkup.Cell></TableMarkup.Row>}</TableMarkup.Body></TableMarkup.Root></div>{loading && <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">Loading report history...</div>}<TablePagination currentPage={history.pagination.page} totalPages={history.pagination.totalPages} totalItems={history.pagination.total} itemsPerPage={history.pagination.limit} isLoading={loading} onPageChange={setPage} onItemsPerPageChange={setLimit} /></div></ReportPageSection>;
}
