import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Badge, type BadgeColor } from "@/components/ui/badge/Badge";
import { Switch } from "@/components/ui/switch/Switch";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { cn } from "@/components/ui/utils";
import { accessExplorer } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { useDebounce } from "@/hooks";
import { settingsApi } from "@/services/api";
import type { AccessExplorerHolder, AccessExplorerHolders, AccessExplorerPermission } from "@/services/api/settings";
import { ROUTES } from "@/app/routes.constants";
import { formatDateTime } from "@/utils/format";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";

const STATUS_COLOR: Record<string, BadgeColor> = { Active: "emerald", Suspended: "orange", Terminated: "red", Pending: "amber", Inactive: "slate" };

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
  </div>
);

/**
 * Access Explorer: from a permission to the people who hold it, and through what (access profile and permission set). It reads the chain the system itself uses to decide
 * (person, active access profile, active permission set, permission), so the answer is what is enforced. Read only.
 */
export const AccessExplorerView: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [options, setOptions] = useState<AccessExplorerPermission[] | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  const [selected, setSelected] = useState<AccessExplorerPermission | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);
  const [result, setResult] = useState<AccessExplorerHolders | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSearchFailed(false);
    settingsApi.searchAccessExplorerPermissions(debounced.trim())
      .then((rows) => { if (!cancelled) setOptions(rows); })
      .catch(() => { if (!cancelled) { setOptions([]); setSearchFailed(true); } });
    return () => { cancelled = true; };
  }, [debounced]);

  useEffect(() => {
    if (!selected) { setResult(null); return undefined; }
    let cancelled = false;
    setLoading(true);
    setError("");
    settingsApi.getAccessExplorerHolders(selected.code, activeOnly)
      .then((response) => { if (!cancelled) setResult(response); })
      .catch((e) => { if (!cancelled) { setResult(null); setError(e?.response?.data?.message || "Unable to read who holds this permission."); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected, activeOnly]);

  const columns: DataTableColumn<AccessExplorerHolder>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_h, i) => i + 1 },
    {
      id: "person",
      header: "Person",
      label: "Person",
      cell: (h) => (
        <button type="button" className="text-left" onClick={() => navigate(ROUTES.SETTINGS.USERS_PROFILE(h.userId), { state: { returnTo: ROUTES.SECURITY.ACCESS_EXPLORER } })}>
          <span className="font-medium text-emerald-700 hover:underline">{h.fullName ?? h.username}</span>
          <span className="block text-xs text-slate-500">{h.username}{h.employeeCode ? ` · ${h.employeeCode}` : ""}</span>
        </button>
      ),
    },
    { id: "department", header: "Department", label: "Department", cell: (h) => h.department || "—" },
    { id: "status", header: "Status", label: "Status", cell: (h) => <Badge size="sm" pill color={STATUS_COLOR[h.status ?? ""] ?? "slate"}>{h.status ?? "—"}</Badge> },
    { id: "profiles", header: "Through Access Profile", label: "Through Access Profile", cell: (h) => <span title={h.viaProfiles.join(", ")}>{h.viaProfiles.join(", ")}</span> },
    { id: "sets", header: "Through Permission Set", label: "Through Permission Set", cell: (h) => <span title={h.viaPermissionSets.join(", ")}>{h.viaPermissionSets.join(", ")}</span> },
    { id: "timeLimited", header: "Time-limited Until", label: "Time-limited Until", cell: (h) => (h.timeLimitedUntil ? formatDateTime(h.timeLimitedUntil) : "—") },
    { id: "lastLogin", header: "Last Sign-in", label: "Last Sign-in", cell: (h) => (h.lastLoginAt ? formatDateTime(h.lastLoginAt) : "Never") },
  ];

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader title="Access Explorer" breadcrumbItems={accessExplorer(navigate)} />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-4 p-4 md:p-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div>
            <label htmlFor="access-explorer-search" className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Find a permission</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="access-explorer-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Code, name or module, for example paper verify"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200" role="listbox" aria-label="Permissions">
              {options === null && <SectionLoading />}
              {searchFailed && <p role="alert" className="p-3 text-sm text-red-600">Unable to load the permissions.</p>}
              {options?.length === 0 && !searchFailed && <p className="p-3 text-sm text-slate-500">No permission matches.</p>}
              {options?.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  role="option"
                  aria-selected={selected?.code === option.code}
                  onClick={() => setSelected(option)}
                  className={cn("block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50", selected?.code === option.code && "bg-emerald-50")}
                >
                  <span className="block text-sm font-medium text-slate-900">{option.name}</span>
                  <span className="block font-mono text-2xs text-slate-500">{option.code}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            {!selected ? (
              <div className="flex h-full min-h-[160px] items-center justify-center rounded-lg border border-dashed border-slate-300 px-6 text-center text-sm text-slate-500">
                Choose a permission to see who holds it and through which access profile and permission set.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
                    <p className="font-mono text-xs text-slate-500">{selected.code}</p>
                    {selected.description && <p className="mt-1 text-sm text-slate-600">{selected.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={activeOnly} onChange={setActiveOnly} aria-label="Only active accounts" />
                    <span className="text-sm text-slate-700">Only active accounts</span>
                    <button type="button" onClick={() => setSelected(null)} aria-label="Clear the choice" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-4 w-4" /></button>
                  </div>
                </div>
                {result && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Stat label="Permission sets" value={result.permissionSets.length} hint="active sets that contain it" />
                    <Stat label="Access profiles" value={new Set(result.permissionSets.flatMap((s) => s.profiles.map((p) => p.id))).size} hint="active profiles that use them" />
                    <Stat label="People" value={result.holderCount} hint={`${result.activeHolderCount} with an Active account`} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {selected && (
          <div className="border-t border-slate-200 p-4 md:p-5">
            {loading && <SectionLoading />}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            {result && !loading && (
              <div className="space-y-5">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">Granted through</h3>
                  {result.permissionSets.length === 0 ? (
                    <p className="text-sm text-slate-500">No active permission set contains this permission, so nobody holds it.</p>
                  ) : (
                    <ul className="grid gap-2 md:grid-cols-2">
                      {result.permissionSets.map((set) => (
                        <li key={set.id} className="rounded-lg border border-slate-200 p-3">
                          <p className="text-sm font-medium text-slate-900">{set.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {set.profiles.length === 0 ? "Not used by any active access profile" : set.profiles.map((p) => `${p.name} (${p.holderCount})`).join(" · ")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-slate-900">People who hold it</h3>
                  <p className="mb-2 text-xs text-slate-500">To keep or send this list, create a report of the type “Permission Holders” in Reports: the run is authorized, audited and kept like every other report.</p>
                  <DataTable
                    rows={result.holders}
                    getRowKey={(h) => h.userId}
                    columns={columns}
                    emptyState={<TableEmptyState title="Nobody holds this permission" description={activeOnly ? "No person with an Active account holds it. Switch off 'Only active accounts' to include the others." : "No person holds it."} />}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
