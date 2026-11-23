import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { Select } from "@/components/ui/select";
import { DataTable, TableEmptyState, TablePagination, type DataTableColumn } from "@/components/ui/table";
import { ROUTES } from "@/app/routes.constants";
import { navigationApi } from "@/services/api/navigation";
import { settingsApi, type PermissionLifecycleUsage, type PermissionSetPermissionPage, type PermissionSetPermissionRow, type PermissionSetSummary } from "@/services/api/settings";
import { useDebounce } from "@/hooks/useDebounce";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { MENU_MODULE_ORDER, moduleDisplayName, moduleOrderFromMenu, sortModulesLikeMenu } from "@/utils/moduleDisplay";
import { statusText } from "@/features/security-authorization/shared/humanizeCode";
import { tr } from "@/i18n";

// Includes the action -- two entries can share the same object type + status (e.g. distributing a
// single Controlled Copy vs. a Controlled Copy Batch both apply "Ready for Distribution"), so the
// action is what tells them apart and must be visible wherever more than one entry is listed together.
const formatLifecycleUsage = (u: PermissionLifecycleUsage) =>
  `${u.objectTypeLabel} · ${u.fromStatus ? statusText(u.fromStatusLabel, u.fromStatus) : "Any state"} (${u.actionLabel})`;

const ALL_MODULES = "";
const PAGE_SIZE = 10;
const EXIT_MS = 250;
const LABEL_CLASS = "mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm";

interface PermissionSetModalProps {
  ps: PermissionSetSummary | null;
  onClose: () => void;
}

export const AccessProfilePermissionSetModal: React.FC<PermissionSetModalProps> = ({ ps, onClose }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [result, setResult] = useState<PermissionSetPermissionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>(ALL_MODULES);
  const [page, setPage] = useState(1);
  const [menuOrder, setMenuOrder] = useState<readonly string[]>(MENU_MODULE_ORDER);
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

  // The module list follows the order of the sidebar menu; the built-in order is used until the menu answers or if it cannot.
  useEffect(() => {
    let cancelled = false;
    navigationApi.getNavigation().then((menu) => {
      const fromMenu = moduleOrderFromMenu(menu);
      if (!cancelled && fromMenu.length > 0) setMenuOrder(fromMenu);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // The search, the Module filter and the page are all done by the server; the page of the last answer stays on screen while the next one loads.
  useEffect(() => {
    if (!ps) return;
    let cancelled = false;
    setLoading(true);
    settingsApi.getPermissionSetPermissions(ps.id, { page, limit: PAGE_SIZE, search: debouncedSearch.trim() || undefined, module: moduleFilter || undefined })
      .then((answer) => { if (!cancelled) { setResult(answer); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ps?.id, page, debouncedSearch, moduleFilter]);

  const moduleOptions = useMemo(() => {
    const found = (result?.modules ?? []).map((m) => ({ key: m.module, name: moduleDisplayName(m.module), count: m.count }));
    // two spellings of one module are one entry (the server filter treats them as the same module)
    const byName = new Map<string, { key: string; name: string; count: number }>();
    for (const m of found) {
      const seen = byName.get(m.name);
      if (seen) seen.count += m.count; else byName.set(m.name, { ...m });
    }
    // a chosen module that the search no longer finds stays in the list, so the box never shows a value that is not an option
    if (moduleFilter && ![...byName.values()].some((m) => m.key === moduleFilter)) {
      byName.set(moduleDisplayName(moduleFilter), { key: moduleFilter, name: moduleDisplayName(moduleFilter), count: 0 });
    }
    const total = found.reduce((sum, m) => sum + m.count, 0);
    return [
      { label: `All modules (${total})`, value: ALL_MODULES },
      ...sortModulesLikeMenu([...byName.values()], (m) => m.name, menuOrder).map((m) => ({ label: `${m.name} (${m.count})`, value: m.key })),
    ];
  }, [result, moduleFilter, menuOrder]);

  if (!ps) return null;

  // The dialog leaves with its closing motion first, then tells the screen.
  const requestClose = () => {
    setOpen(false);
    window.setTimeout(onClose, EXIT_MS);
  };

  const rows = result?.data ?? [];
  const total = result?.pagination.total ?? 0;
  const totalPages = result?.pagination.totalPages ?? 1;
  const none = <span className="text-slate-400">-</span>;
  const wrap = "whitespace-normal align-top";
  const first = (page - 1) * PAGE_SIZE;

  const columns: DataTableColumn<PermissionSetPermissionRow>[] = [
    {
      id: "no", header: "No.", label: "No.", locked: true,
      // fixed at the left while the other columns scroll; narrower on a phone
      headerClassName: "left-0 z-30 w-10 min-w-0 px-2 text-center md:w-16 md:px-4",
      cellClassName: "sticky left-0 z-10 w-10 min-w-0 bg-white px-2 text-center align-top text-slate-500 md:w-16 md:px-4",
      cell: (_row, index) => first + index + 1,
    },
    { id: "name", header: tr("Permission"), label: tr("Permission"), cellClassName: `${wrap} min-w-[200px] font-medium text-slate-900`, cell: (row) => row.name },
    { id: "module", header: "Module", label: "Module", cellClassName: `${wrap} min-w-[140px]`, cell: (row) => moduleDisplayName(row.module) },
    { id: "code", header: "Code", label: "Code", cellClassName: "align-top font-mono text-xs text-slate-600", cell: (row) => row.code },
    { id: "audit", header: "Audit", label: "Audit", cellClassName: "align-top", cell: (row) => (row.requiresAudit ? <Badge size="xs" color="indigo">{tr("Audit")}</Badge> : none) },
    { id: "description", header: "Description", label: "Description", cellClassName: `${wrap} min-w-[280px] text-slate-600`, cell: (row) => row.description || none },
    {
      id: "lifecycle", header: tr("Used in workflow"), label: tr("Used in workflow"), cellClassName: `${wrap} min-w-[240px]`,
      cell: (row) => (row.lifecycleUsages.length > 0
        ? <div className="flex flex-col items-start gap-1">{row.lifecycleUsages.map((u, i) => <Badge key={i} size="xs" color="purple">{formatLifecycleUsage(u)}</Badge>)}</div>
        : none),
    },
  ];

  const searching = Boolean(debouncedSearch.trim() || moduleFilter);

  return (
    <FormModal
      isOpen={open}
      onClose={requestClose}
      onConfirm={() => navigate(ROUTES.SECURITY.PERMISSION_SETS)}
      title={`Permission Set: ${ps.name}`}
      description={ps.description}
      confirmText="Open Permission Sets"
      cancelText="Close"
      size="3xl"
      className="!max-w-6xl"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="permission-set-search" className={LABEL_CLASS}>{tr("Search")}</label>
            <SearchInput
              value={search}
              onChange={(value) => { setSearch(value); setPage(1); }}
              ariaLabel="Search permissions"
              placeholder={tr("Search by name, code or description…")}
              inputProps={{ id: "permission-set-search" }}
            />
          </div>
          <div className="sm:w-64">
            <Select
              label={<span className={LABEL_CLASS}>{tr("Module")}</span>}
              aria-label={tr("Filter by module")}
              value={moduleFilter}
              onChange={(value) => { setModuleFilter(value); setPage(1); }}
              options={moduleOptions}
              enableSearch
            />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <DataTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.code}
            isLoading={loading && !result}
            emptyState={failed
              ? <TableEmptyState title={tr("Could not load the permissions")} description={tr("Close this window and open it again.")} />
              : <TableEmptyState title={searching ? tr("No results") : "No permissions assigned"} description={searching ? "No permission matches the search or the module." : "This Permission Set grants nothing yet."} />}
            pagination={total > 0 ? (
              <div className="border-t border-slate-200">
                <TablePagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={total}
                  itemsPerPage={PAGE_SIZE}
                  isLoading={loading}
                  onPageChange={setPage}
                  showItemsPerPageSelector={false}
                />
              </div>
            ) : undefined}
          />
        </div>
      </div>
    </FormModal>
  );
};
