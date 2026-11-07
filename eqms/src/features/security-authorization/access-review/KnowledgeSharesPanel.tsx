import React, { useCallback, useEffect, useState } from "react";
import { Check, MoreVertical, Search, ShieldCheck, ShieldX, X } from "lucide-react";
import { IconFilter2, IconTrash } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
import { ConfiguredDesktopFilters } from "@/components/ui/filter/ConfiguredDesktopFilters";
import { FilterAccordionItem, FilterDrawer } from "@/components/ui/filter/FilterDrawer";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { cn } from "@/components/ui/utils";
import { useToast } from "@/components/ui/toast/Toast";
import { useDebounce, usePortalDropdown } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { metadataApi } from "@/services/api/metadata";
import { knowledgeSharesApi, type KnowledgeShareRow } from "@/services/api/knowledgeShares";
import { formatDateTime } from "@/utils/format";

const EFFECT_OPTIONS: SelectOption[] = [
  { value: "ALL", label: "All" },
  { value: "ALLOW", label: "Shared" },
  { value: "DENY", label: "Excluded" },
];

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data?.error?.message ?? fallback;

/**
 * Access Review > Knowledge Shares: what the Department Heads shared in the Knowledge Base, for oversight. The administrator can see every
 * share and, with the permission to manage object access rules, remove one on behalf of the Department Head (the Audit Trail records who
 * removed it). Laid out like the Campaigns tab: filters, a table with the common No. column, sortable headers, a column control and paging
 * on the server. "Check access" lives in the page title (see AccessReviewView).
 */
export const KnowledgeSharesPanel: React.FC = () => {
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canRevoke = hasPermissionAlias("security.object_rules.manage");
  const { openId, position, getRef, toggle, close } = usePortalDropdown();

  const [rows, setRows] = useState<KnowledgeShareRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [departmentId, setDepartmentId] = useState("");
  const [effect, setEffect] = useState("ALL");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [version, setVersion] = useState(0);
  const [departmentOptions, setDepartmentOptions] = useState<SelectOption[]>([{ value: "", label: "All Departments" }]);

  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedFilterSections, setExpandedFilterSections] = useState<Set<string>>(() => new Set(["department"]));
  const [revokeTarget, setRevokeTarget] = useState<KnowledgeShareRow | null>(null);

  const toggleFilterSection = (section: string) => {
    setExpandedFilterSections((previous) => {
      const next = new Set(previous);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  useEffect(() => {
    metadataApi.getDepartments()
      .then((items) => setDepartmentOptions([{ value: "", label: "All Departments" }, ...items.map((d) => ({ value: d.id, label: d.name }))]))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await knowledgeSharesApi.list({
        page: currentPage, limit: itemsPerPage, search: debouncedSearch || undefined, departmentId: departmentId || undefined,
        effect: effect === "ALL" ? undefined : effect, sortBy: sortKey, sortDir,
      });
      setRows(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(Math.max(1, result.pagination.totalPages));
    } catch (error) {
      setLoadError(true);
      showToast({ type: "error", message: errorMessage(error, "Unable to load the Knowledge shares.") });
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch, departmentId, effect, sortKey, sortDir, showToast]);

  useEffect(() => { void load(); }, [load, version]);

  const hasFilters = !!search || !!departmentId || effect !== "ALL";
  const clearFilters = () => { setSearch(""); setDepartmentId(""); setEffect("ALL"); setCurrentPage(1); };
  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  };
  const sortOf = (key: string) => ({ direction: sortKey === key ? sortDir : undefined, onSort: () => handleSort(key) });

  const revoke = async () => {
    if (!revokeTarget) return;
    try {
      await knowledgeSharesApi.revoke(revokeTarget.ruleId);
      showToast({ type: "success", message: "Share removed. The Audit Trail records who removed it." });
      setVersion((v) => v + 1);
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error, "Unable to remove the share.") });
    } finally {
      setRevokeTarget(null);
    }
  };

  const columns: DataTableColumn<KnowledgeShareRow>[] = [
    {
      id: "no",
      header: "No.",
      label: "No.",
      locked: true,
      headerClassName: TABLE_STYLES.headerCell34,
      cellClassName: "text-center text-slate-500",
      cell: (_row, index) => (currentPage - 1) * itemsPerPage + index + 1,
    },
    { id: "department", header: "Department", label: "Department", sort: sortOf("department"), cell: (r) => <span className="font-medium text-slate-800">{r.departmentName}</span> },
    { id: "item", header: "Shared item", label: "Shared item", sort: sortOf("scope"), cellClassName: "text-slate-700", cell: (r) => r.scopeLabel },
    {
      id: "effect",
      header: "Effect",
      label: "Effect",
      sort: sortOf("effect"),
      cell: (r) => (
        <Badge color={r.effect === "ALLOW" ? "emerald" : "red"} size="sm" pill className="gap-1">
          {r.effect === "ALLOW" ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
          {r.effect === "ALLOW" ? "Shared" : "Excluded"}
        </Badge>
      ),
    },
    {
      id: "people",
      header: "People",
      label: "People",
      cell: (r) => (
        <div className="flex max-w-[24rem] flex-wrap gap-1">
          {r.grantees.slice(0, 4).map((g) => <Badge key={g} color={g === "Everyone" ? "amber" : "slate"} size="xs">{g}</Badge>)}
          {r.grantees.length > 4 && <Badge color="slate" size="xs" title={r.grantees.join(", ")}>+{r.grantees.length - 4}</Badge>}
        </div>
      ),
    },
    { id: "createdBy", header: "Shared by", label: "Shared by", sort: sortOf("createdBy"), cellClassName: "text-slate-600", cell: (r) => r.createdBy ?? "-" },
    { id: "createdAt", header: "Date", label: "Date", sort: sortOf("createdAt"), cellClassName: "text-slate-600", cell: (r) => (r.createdAt ? formatDateTime(r.createdAt) : "-") },
  ];

  const rowAction: DataTableAction<KnowledgeShareRow> | undefined = canRevoke
    ? {
        header: "Actions",
        cell: (r) => (
          <>
            <button
              ref={getRef(r.ruleId)}
              onClick={(e) => toggle(r.ruleId, e)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 sm:h-8 sm:w-8"
              aria-label={`Actions for the share of ${r.scopeLabel}`}
            >
              <MoreVertical className="h-4 w-4 text-slate-600" />
            </button>
            <PortalDropdownMenu isOpen={openId === r.ruleId} onClose={close} position={position}>
              <div className="py-1">
                <DropdownMenuItem icon={<IconTrash className="h-4 w-4" />} onClick={() => { setRevokeTarget(r); close(); }}>
                  Remove this share
                </DropdownMenuItem>
              </div>
            </PortalDropdownMenu>
          </>
        ),
      }
    : undefined;

  const { layout, control } = useCustomColumnLayout("access-review.knowledge-shares", columns, rowAction);

  const optionButtons = (options: SelectOption[], value: string, onPick: (v: string) => void) => (
    <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => { onPick(String(opt.value)); setCurrentPage(1); }}
          className={cn(
            "flex items-center justify-between rounded-lg border px-4 py-2.5 transition-all",
            value === opt.value
              ? "border-emerald-500 bg-white font-semibold text-emerald-700 shadow-sm shadow-emerald-100/50"
              : "border-slate-200 bg-white font-medium text-slate-500 hover:border-slate-300",
          )}
        >
          <span className="text-xs">{opt.label}</span>
          {value === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      {/* Filter Section -- laid out like User Management */}
      <div className="compact-filter-section px-4 pt-4 md:p-5 flex flex-col">
        <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
          <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-800">
            The Department Heads decide who sees the Effective documents of their Department in the Knowledge Base (right-click &gt; Share in the
            Knowledge explorer). This list is for oversight: you can see every share and, if you hold the permission to manage object access rules,
            remove one on behalf of the Department Head. It matters only while Document Properties &gt; Knowledge Base Visibility is{" "}
            <strong>Sharing</strong>.
          </div>

          {/* Mobile: search + filter drawer */}
          <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block capitalize">Search</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  aria-label="Search shares"
                  placeholder="Search by item, person or Department..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                />
                {search && (
                  <button onClick={() => { setSearch(""); setCurrentPage(1); }} aria-label="Clear search" className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
                <IconFilter2 className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>

          {/* Desktop filters */}
          <ConfiguredDesktopFilters
            trailing={<div className="hidden md:block">{control}</div>}
            search={
              <FilterSearchInput
                aria-label="Search"
                value={search}
                onChange={(value) => { setSearch(value); setCurrentPage(1); }}
                placeholder="Search by item, person or Department..."
              />
            }
            filters={[
              { id: "departmentFilter", label: "Department", value: departmentId, options: departmentOptions, onChange: (v) => { setDepartmentId(String(v)); setCurrentPage(1); } },
              { id: "effectFilter", label: "Effect", value: effect, options: EFFECT_OPTIONS, onChange: (v) => { setEffect(String(v)); setCurrentPage(1); } },
            ]}
          >
            <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block transition-colors capitalize">Search</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
                    <Search className="h-4 w-4 text-slate-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    aria-label="Search shares"
                    placeholder="Search by item, person or Department..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <Select label="Department" value={departmentId} onChange={(v) => { setDepartmentId(String(v)); setCurrentPage(1); }} options={departmentOptions} />
              <Select label="Effect" value={effect} onChange={(v) => { setEffect(String(v)); setCurrentPage(1); }} options={EFFECT_OPTIONS} enableSearch={false} />
              <div className="filter-actions flex items-end gap-2">
                <ClearFiltersButton onClearSearch={() => setSearch("")} onClear={clearFilters} disabled={!hasFilters} />
                {control}
              </div>
            </div>
          </ConfiguredDesktopFilters>
        </div>
      </div>

      {/* Table Section */}
      <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[4px]">
            <SectionLoading minHeight="150px" />
          </div>
        )}
        {!loading && rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-12">
            <TableEmptyState
              title={loadError ? "Unable to load the shares" : hasFilters ? "No share matches the filters" : "No share yet"}
              description={
                loadError ? "Reload the page to try again."
                  : hasFilters ? "Try another search or clear the filters."
                  : "No Department Head has shared anything in the Knowledge Base."
              }
            />
          </div>
        ) : (
          <DataTable
            rows={rows}
            getRowKey={(r) => r.ruleId}
            columns={layout.columns}
            columnLayout={layout}
            action={rowAction}
            pagination={
              totalItems > 0 ? (
                <div className="border-t border-slate-200">
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    isLoading={loading}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
                    itemsPerPageOptions={[10, 20, 50]}
                  />
                </div>
              ) : undefined
            }
          />
        )}
      </div>

      {/* Mobile filter drawer */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem label="Department" isExpanded={expandedFilterSections.has("department")} onToggle={() => toggleFilterSection("department")}>
          {optionButtons(departmentOptions, departmentId, setDepartmentId)}
        </FilterAccordionItem>
        <FilterAccordionItem label="Effect" isExpanded={expandedFilterSections.has("effect")} onToggle={() => toggleFilterSection("effect")}>
          {optionButtons(EFFECT_OPTIONS, effect, setEffect)}
        </FilterAccordionItem>
      </FilterDrawer>

      <AlertModal
        isOpen={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={revoke}
        type="confirm"
        title="Remove this share?"
        description={
          <p className="text-sm text-slate-600">
            The {revokeTarget?.effect === "DENY" ? "exclusion" : "share"} of <strong>{revokeTarget?.scopeLabel}</strong> in{" "}
            <strong>{revokeTarget?.departmentName}</strong> is removed on behalf of the Department Head. The Audit Trail records who removed it.
          </p>
        }
        confirmText="Remove"
        cancelText="Cancel"
      />
    </div>
  );
};
