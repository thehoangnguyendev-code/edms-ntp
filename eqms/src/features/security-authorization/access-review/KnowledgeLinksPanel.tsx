import React, { useCallback, useEffect, useState } from "react";
import { Check, MoreVertical, Search, X } from "lucide-react";
import { IconFilter2, IconLinkOff } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import { ConfiguredDesktopFilters } from "@/components/ui/filter/ConfiguredDesktopFilters";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
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
import { knowledgeSharesApi, type KnowledgeLinkAdminRow } from "@/services/api/knowledgeShares";
import { formatDateTime } from "@/utils/format";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "REVOKED", label: "Revoked" },
];

const STATUS_COLOR = { ACTIVE: "emerald", EXPIRED: "slate", REVOKED: "red" } as const;
const STATUS_LABEL = { ACTIVE: "Active", EXPIRED: "Expired", REVOKED: "Revoked" } as const;
const LEVEL_LABEL: Record<string, string> = {
  ADMIN: "Administrator", UNIT_HEAD: "Head of Unit", DEPARTMENT_HEAD: "Department Head", DELEGATE: "Shares for the Head",
};

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data?.error?.message ?? fallback;

/**
 * Access Review > Knowledge Links: the links the Heads and the people they named made to folders and documents of the Knowledge Base, for
 * oversight. The administrator sees every link (owner, what it points to, status, who made it, how many people opened it) and, with the
 * permission to manage object access rules, revokes one at once: a revoked link opens nothing, even for people who saved it. The link itself
 * is not shown here or anywhere after it was made (only its hash is stored). Laid out like the Knowledge Shares tab.
 */
export const KnowledgeLinksPanel: React.FC = () => {
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canRevoke = hasPermissionAlias("security.object_rules.manage");
  const { openId, position, getRef, toggle, close } = usePortalDropdown();

  const [rows, setRows] = useState<KnowledgeLinkAdminRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState("ALL");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [version, setVersion] = useState(0);

  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<KnowledgeLinkAdminRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await knowledgeSharesApi.listLinks({
        page: currentPage, limit: itemsPerPage, search: debouncedSearch || undefined, status: status === "ALL" ? undefined : status, sortBy: sortKey, sortDir,
      });
      setRows(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(Math.max(1, result.pagination.totalPages));
    } catch (error) {
      setLoadError(true);
      showToast({ type: "error", message: errorMessage(error, "Unable to load the Knowledge links.") });
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch, status, sortKey, sortDir, showToast]);

  useEffect(() => { void load(); }, [load, version]);

  const hasFilters = !!search || status !== "ALL";
  const clearFilters = () => { setSearch(""); setStatus("ALL"); setCurrentPage(1); };
  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  };
  const sortOf = (key: string) => ({ direction: sortKey === key ? sortDir : undefined, onSort: () => handleSort(key) });

  const revoke = async () => {
    if (!revokeTarget) return;
    try {
      await knowledgeSharesApi.revokeLink(revokeTarget.id);
      showToast({ type: "success", message: "Link revoked. It no longer opens anything. The Audit Trail records who revoked it." });
      setVersion((v) => v + 1);
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error, "Unable to revoke the link.") });
    } finally {
      setRevokeTarget(null);
    }
  };

  const columns: DataTableColumn<KnowledgeLinkAdminRow>[] = [
    {
      id: "no",
      header: "No.",
      label: "No.",
      locked: true,
      headerClassName: TABLE_STYLES.headerCell34,
      cellClassName: "text-center text-slate-500",
      cell: (_row, index) => (currentPage - 1) * itemsPerPage + index + 1,
    },
    { id: "owner", header: "Department / Unit", label: "Department / Unit", sort: sortOf("owner"), cell: (r) => <span className="font-medium text-slate-800">{r.ownerName}</span> },
    {
      id: "item",
      header: "Points to",
      label: "Points to",
      sort: sortOf("item"),
      cell: (r) => (
        <div className="max-w-[22rem]">
          <div className="truncate text-slate-800" title={r.label}>{r.label}</div>
          <div className="text-xs text-slate-500">{r.scopeLabel}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      label: "Status",
      sort: sortOf("status"),
      cell: (r) => <Badge color={STATUS_COLOR[r.status]} size="sm" pill>{STATUS_LABEL[r.status]}</Badge>,
    },
    {
      id: "createdBy",
      header: "Made by",
      label: "Made by",
      sort: sortOf("createdBy"),
      cell: (r) => (
        <div>
          <div className="text-slate-700">{r.createdBy ?? "-"}</div>
          <div className="text-xs text-slate-500">{LEVEL_LABEL[r.createdByLevel] ?? r.createdByLevel}</div>
        </div>
      ),
    },
    { id: "createdAt", header: "Made on", label: "Made on", sort: sortOf("createdAt"), cellClassName: "text-slate-600", cell: (r) => (r.createdAt ? formatDateTime(r.createdAt) : "-") },
    {
      id: "expiresAt",
      header: "Expires",
      label: "Expires",
      sort: sortOf("expiresAt"),
      cellClassName: "text-slate-600",
      cell: (r) => (r.revokedAt ? <span className="text-red-600">Revoked {formatDateTime(r.revokedAt)}{r.revokedBy ? ` by ${r.revokedBy}` : ""}</span> : r.expiresAt ? formatDateTime(r.expiresAt) : "Never"),
    },
    { id: "opens", header: "Opened by", label: "Opened by", sort: sortOf("opens"), cellClassName: "text-slate-600", cell: (r) => `${r.opens} ${r.opens === 1 ? "person" : "people"}` },
  ];

  const rowAction: DataTableAction<KnowledgeLinkAdminRow> | undefined = canRevoke
    ? {
        header: "Actions",
        cell: (r) => (
          <>
            <button
              ref={getRef(r.id)}
              onClick={(e) => toggle(r.id, e)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 sm:h-8 sm:w-8"
              aria-label={`Actions for the link to ${r.label}`}
            >
              <MoreVertical className="h-4 w-4 text-slate-600" />
            </button>
            <PortalDropdownMenu isOpen={openId === r.id} onClose={close} position={position}>
              <div className="py-1">
                {r.status === "ACTIVE" ? (
                  <DropdownMenuItem icon={<IconLinkOff className="h-4 w-4" />} onClick={() => { setRevokeTarget(r); close(); }}>
                    Revoke this link
                  </DropdownMenuItem>
                ) : (
                  <p className="px-3 py-2 text-xs text-slate-500">This link no longer opens anything.</p>
                )}
              </div>
            </PortalDropdownMenu>
          </>
        ),
      }
    : undefined;

  const { layout, control } = useCustomColumnLayout("access-review.knowledge-links", columns, rowAction);

  return (
    <div className="flex flex-1 flex-col">
      {/* Filter Section -- laid out like the Knowledge Shares tab and User Management */}
      <div className="compact-filter-section px-4 pt-4 md:p-5 flex flex-col">
        <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
          <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-800">
            A link lets a signed-in user who holds the Knowledge permission see a folder or a document of the Knowledge Base until it expires or is revoked.
            The Heads and the people they named make links in the Share dialog of the Knowledge explorer. Here you see every link and, if you hold the
            permission to manage object access rules, revoke one at once. The link itself is never shown again after it was made.
          </div>

          <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block capitalize">Search</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  aria-label="Search links"
                  placeholder="Search by item, Department or person..."
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
              <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="gap-2 whitespace-nowrap">
                <IconFilter2 className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>

          <ConfiguredDesktopFilters
            trailing={<div className="hidden md:block">{control}</div>}
            search={
              <FilterSearchInput
                aria-label="Search"
                value={search}
                onChange={(value) => { setSearch(value); setCurrentPage(1); }}
                placeholder="Search by item, Department or person..."
              />
            }
            filters={[{ id: "statusFilter", label: "Status", value: status, options: STATUS_OPTIONS, onChange: (v) => { setStatus(String(v)); setCurrentPage(1); } }]}
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
                    aria-label="Search links"
                    placeholder="Search by item, Department or person..."
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
              <Select label="Status" value={status} onChange={(v) => { setStatus(String(v)); setCurrentPage(1); }} options={STATUS_OPTIONS} enableSearch={false} />
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
              title={loadError ? "Unable to load the links" : hasFilters ? "No link matches the filters" : "No link yet"}
              description={
                loadError ? "Reload the page to try again."
                  : hasFilters ? "Try another search or clear the filters."
                  : "Nobody has made a link to the Knowledge Base."
              }
            />
          </div>
        ) : (
          <DataTable
            rows={rows}
            getRowKey={(r) => r.id}
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
      <FilterDrawer isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} onClear={clearFilters} onApply={() => setIsFilterDrawerOpen(false)}>
        <FilterAccordionItem label="Status" isExpanded onToggle={() => undefined}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => { setStatus(String(opt.value)); setCurrentPage(1); }}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-2.5 transition-all",
                  status === opt.value
                    ? "border-emerald-500 bg-white font-semibold text-emerald-700 shadow-sm shadow-emerald-100/50"
                    : "border-slate-200 bg-white font-medium text-slate-500 hover:border-slate-300",
                )}
              >
                <span className="text-xs">{opt.label}</span>
                {status === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>

      <AlertModal
        isOpen={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={revoke}
        type="confirm"
        title="Revoke this link?"
        description={
          <p className="text-sm text-slate-600">
            The link to <strong>{revokeTarget?.label}</strong> ({revokeTarget?.ownerName}) stops opening anything at once, even for people who saved it.
            People who already have access through a share keep it. The Audit Trail records who revoked it.
          </p>
        }
        confirmText="Revoke"
        cancelText="Cancel"
      />
    </div>
  );
};
