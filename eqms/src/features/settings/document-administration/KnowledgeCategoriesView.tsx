import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { IconFilter2, IconPencilMinus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import {
  FilterDrawer,
  FilterAccordionItem,
} from "@/components/ui/filter/FilterDrawer";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { knowledgeCategories } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { cn } from "@/components/ui/utils";
import { useToast } from "@/components/ui/toast";
import { useDebounce, usePortalDropdown, useTableDragScroll } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import {
  knowledgeApi,
  type KnowledgeHierarchy,
} from "@/services/api/knowledge";
import { formatDateTime } from "@/utils/format";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

const COLUMNS = [
  { key: "name", label: "Name", sortable: true },
  {
    key: "determinatorField",
    label: "Knowledge Base Field Determinator",
    sortable: true,
  },
  { key: "levels", label: "Levels", sortable: true },
  { key: "active", label: "Status", sortable: true },
  { key: "updatedAt", label: "Last Updated", sortable: true },
  { key: "updatedBy", label: "Updated By", sortable: true },
] as const;

const STATUS_OPTIONS = [
  { label: "All Status", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

const menuItemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors";
const menuItemDisabledClass =
  "opacity-50 cursor-not-allowed hover:bg-transparent";

const errorMessage = (error: unknown, fallback: string) =>
  (
    error as {
      response?: { data?: { error?: { message?: string }; message?: string } };
    }
  )?.response?.data?.error?.message ??
  (error as { response?: { data?: { message?: string } } })?.response?.data
    ?.message ??
  fallback;

export const KnowledgeCategoriesView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias(
    "documents.admin.knowledge_categories.manage",
  );
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = useMemo(
    () =>
      shouldReduceMotion
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 90, damping: 16 },
    [shouldReduceMotion],
  );

  const [rows, setRows] = useState<KnowledgeHierarchy[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState("ALL");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeHierarchy | null>(
    null,
  );
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["status", "updated"]),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await knowledgeApi.listHierarchies({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: status === "ALL" ? undefined : status,
        updatedFrom: updatedFrom || undefined,
        updatedTo: updatedTo || undefined,
        sortBy: sortKey,
        sortDir,
      });
      setRows(result.data);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      showToast({
        type: "error",
        title: "Failed to load",
        message: errorMessage(error, "Unable to load the hierarchies."),
      });
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    status,
    updatedFrom,
    updatedTo,
    sortKey,
    sortDir,
    showToast,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasFilters =
    Boolean(search) ||
    status !== "ALL" ||
    Boolean(updatedFrom) ||
    Boolean(updatedTo);
  const clearFilters = () => {
    setSearch("");
    setStatus("ALL");
    setUpdatedFrom("");
    setUpdatedTo("");
    setPage(1);
  };

  const handleSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleSection = (section: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  const optionClass = (active: boolean) =>
    cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      active
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
    );

  const makeDefault = async (row: KnowledgeHierarchy) => {
    close();
    try {
      await knowledgeApi.setDefault(row.id);
      showToast({
        type: "success",
        title: "Default changed",
        message: `"${row.name}" now drives the Knowledge portal.`,
      });
      await load();
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not change the default",
        message: errorMessage(error, "Unable to change the default hierarchy."),
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await knowledgeApi.deleteHierarchy(deleteTarget.id);
      showToast({
        type: "success",
        title: "Hierarchy deleted",
        message: `"${deleteTarget.name}" was deleted.`,
      });
      setDeleteTarget(null);
      await load();
    } catch (error) {
      setDeleteTarget(null);
      showToast({
        type: "error",
        title: "Could not delete",
        message: errorMessage(error, "Unable to delete the hierarchy."),
      });
    }
  };

  const menuRow = rows.find((row) => row.id === openId);

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Knowledge Categories Hierarchies"
        breadcrumbItems={knowledgeCategories(navigate)}
        actions={
          canManage ? (
            <Button
              size="sm"
              className="flex items-center gap-2 whitespace-nowrap"
              onClick={() =>
                navigate(ROUTES.DOCUMENTS.ADMIN.KNOWLEDGE_CATEGORIES_NEW)
              }
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        <div className="px-4 pt-4 md:p-5 flex flex-col">
          <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
            {/* Mobile: search + filter drawer */}
            <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
              <label className="text-xs sm:text-sm font-medium text-slate-700 block">
                Search
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name or description..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                  />
                  {search && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setPage(1);
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="whitespace-nowrap gap-2"
                >
                  <IconFilter2 className="h-4 w-4" />
                  Filters
                </Button>
              </div>
            </div>

            {/* Desktop / tablet filters */}
            <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block transition-colors">
                  Search
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
                    <Search className="h-4 w-4 text-slate-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name or description..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
                  />
                  {search && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setPage(1);
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <Select
                label="Status"
                value={status}
                onChange={(value) => {
                  setStatus(String(value));
                  setPage(1);
                }}
                options={STATUS_OPTIONS}
              />
              <DateRangePicker
                label="Last Updated Range"
                startDate={updatedFrom}
                endDate={updatedTo}
                onStartDateChange={(value) => {
                  setUpdatedFrom(value);
                  setPage(1);
                }}
                onEndDateChange={(value) => {
                  setUpdatedTo(value);
                  setPage(1);
                }}
                placeholder="Select date range"
                autoApply
              />
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  disabled={!hasFilters}
                  className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap disabled:opacity-40"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
          {loading && (
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300">
              <SectionLoading text="Searching..." minHeight="150px" />
            </div>
          )}
          <div
            className={cn(
              "border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300",
              loading && "blur-[2px] opacity-80",
            )}
          >
            {rows.length > 0 ? (
              <>
                <div
                  ref={scrollerRef}
                  className={cn(
                    "flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400",
                    isDragging ? "cursor-grabbing select-none" : "cursor-grab",
                  )}
                  {...dragEvents}
                >
                  <TableMarkup.Root className="w-full min-w-max border-spacing-0 text-left">
                    <TableMarkup.Head className="sticky top-0 z-30">
                      <TableMarkup.Row>
                        <TableMarkup.HeaderCell className={TABLE_STYLES.emptyCell4} />
                        <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell29}>
                          No.
                        </TableMarkup.HeaderCell>
                        {COLUMNS.map((col) => {
                          const isSorted = sortKey === col.key;
                          return (
                            <TableMarkup.HeaderCell
                              key={col.key}
                              onClick={() => handleSort(col.key)}
                              className={TABLE_STYLES.headerCell30}
                            >
                              <div className="flex items-center justify-between gap-2 w-full">
                                <span className="truncate">{col.label}</span>
                                <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                                  <ChevronUp
                                    className={cn(
                                      "h-3 w-3 -mb-1",
                                      isSorted && sortDir === "asc"
                                        ? "text-emerald-600"
                                        : "",
                                    )}
                                  />
                                  <ChevronDown
                                    className={cn(
                                      "h-3 w-3",
                                      isSorted && sortDir === "desc"
                                        ? "text-emerald-600"
                                        : "",
                                    )}
                                  />
                                </div>
                              </div>
                            </TableMarkup.HeaderCell>
                          );
                        })}
                        <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell24}>
                          Action
                        </TableMarkup.HeaderCell>
                      </TableMarkup.Row>
                    </TableMarkup.Head>
                    <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                      {rows.map((row, index) => {
                        const tdClass =
                          "py-3 px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap";
                        return (
                          <React.Fragment key={row.id}>
                            <TableMarkup.Row className="hover:bg-slate-50/80 transition-colors group">
                              <TableMarkup.Cell
                                className="py-3 px-2 text-center whitespace-nowrap"
                                onClick={() => toggleExpanded(row.id)}
                              >
                                <button
                                  className="flex items-center justify-center h-5 w-5 md:h-6 md:w-6 rounded-lg hover:bg-slate-200 transition-colors mx-auto"
                                  aria-label="Show levels"
                                >
                                  <motion.span
                                    animate={{
                                      rotate: expanded.has(row.id) ? 90 : 0,
                                    }}
                                    transition={transitionConfig}
                                    className="inline-flex items-center justify-center"
                                  >
                                    <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500" />
                                  </motion.span>
                                </button>
                              </TableMarkup.Cell>
                              <TableMarkup.Cell className={cn(tdClass, "text-center")}>
                                <span className="text-slate-500 font-medium">
                                  {(page - 1) * pageSize + index + 1}
                                </span>
                              </TableMarkup.Cell>
                              <TableMarkup.Cell className={tdClass}>
                                <span
                                  className="font-medium text-emerald-600 cursor-pointer hover:underline"
                                  onClick={() =>
                                    navigate(
                                      ROUTES.DOCUMENTS.ADMIN.KNOWLEDGE_CATEGORIES_EDIT(
                                        row.id,
                                      ),
                                    )
                                  }
                                >
                                  {row.name}
                                </span>
                                {row.isDefault && (
                                  <Badge
                                    size="sm"
                                    color="blue"
                                    className="ml-2"
                                  >
                                    Default
                                  </Badge>
                                )}
                                {row.description && (
                                  <div
                                    className="text-xs text-slate-500 max-w-md truncate"
                                    title={row.description}
                                  >
                                    {row.description}
                                  </div>
                                )}
                              </TableMarkup.Cell>
                              <TableMarkup.Cell className={tdClass}>
                                {row.determinatorLabel}
                              </TableMarkup.Cell>
                              <TableMarkup.Cell className={tdClass}>{row.levels.length}</TableMarkup.Cell>
                              <TableMarkup.Cell className={tdClass}>
                                <Badge
                                  size="sm"
                                  color={row.active ? "emerald" : "slate"}
                                  pill
                                >
                                  {row.active ? "Active" : "Inactive"}
                                </Badge>
                              </TableMarkup.Cell>
                              <TableMarkup.Cell className={tdClass}>
                                {row.updatedAt
                                  ? formatDateTime(row.updatedAt)
                                  : "-"}
                              </TableMarkup.Cell>
                              <TableMarkup.Cell className={tdClass}>
                                {row.updatedByName || "-"}
                              </TableMarkup.Cell>
                              <TableMarkup.Cell
                                onClick={(e) => e.stopPropagation()}
                                className={TABLE_STYLES.cell34}
                              >
                                <button
                                  ref={getRef(row.id)}
                                  onClick={(e) =>
                                    toggle(row.id, e, {
                                      menuWidth: 220,
                                      menuHeight: 160,
                                    })
                                  }
                                  className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                                >
                                  <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                </button>
                              </TableMarkup.Cell>
                            </TableMarkup.Row>
                            <AnimatePresence initial={false}>
                              {expanded.has(row.id) && (
                                <motion.tr
                                  key={`levels-${row.id}`}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={transitionConfig}
                                  className="bg-slate-50/50"
                                >
                                  <TableMarkup.Cell
                                    colSpan={COLUMNS.length + 3}
                                    className="p-0 border-b border-slate-200"
                                  >
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={transitionConfig}
                                      className="overflow-hidden"
                                    >
                                      <div className="p-4 md:p-5">
                                        <div className="ml-9">
                                          <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                            Knowledge Category Levels ({row.levels.length})
                                          </p>
                                          {row.levels.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-xs text-slate-500">
                                              No levels: documents are listed directly under each Knowledge Base.
                                            </div>
                                          ) : (
                                            <ol className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-700">
                                              <li className="flex items-center gap-1.5">
                                                <Layers className="h-3.5 w-3.5 text-slate-400" />
                                                <b>{row.determinatorLabel}</b> (Knowledge Base)
                                              </li>
                                              {row.levels.map((level) => (
                                                <li key={level.id} className="flex items-center gap-2">
                                                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                                  <span>
                                                    {level.fieldLabel}{" "}
                                                    <span className="text-xs text-slate-500">(order {level.displayOrder})</span>
                                                  </span>
                                                </li>
                                              ))}
                                            </ol>
                                          )}
                                        </div>
                                      </div>
                                    </motion.div>
                                  </TableMarkup.Cell>
                                </motion.tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        );
                      })}
                    </TableMarkup.Body>
                  </TableMarkup.Root>
                </div>
                <TablePagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={total}
                  itemsPerPage={pageSize}
                  onPageChange={setPage}
                  onItemsPerPageChange={(value) => {
                    setPageSize(value);
                    setPage(1);
                  }}
                  showItemCount
                />
              </>
            ) : (
              <TableEmptyState
                title="No Hierarchies Found"
                description="We couldn't find any hierarchies matching your filters. Try adjusting your search criteria."
              />
            )}
          </div>
        </div>
      </div>

      {/* Action menu */}
      {menuRow && (
        <PortalDropdownMenu
          isOpen
          onClose={close}
          position={position}
          minWidth={220}
        >
          <div className="py-1 whitespace-nowrap">
            <button
              onClick={() => {
                close();
                navigate(
                  ROUTES.DOCUMENTS.ADMIN.KNOWLEDGE_CATEGORIES_EDIT(menuRow.id),
                );
              }}
              className={menuItemClass}
            >
              <IconPencilMinus className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium text-slate-500">
                {canManage ? "Edit Hierarchy" : "View Hierarchy"}
              </span>
            </button>
            {canManage && (
              <button
                onClick={() => {
                  if (menuRow.isDefault || !menuRow.active) return;
                  void makeDefault(menuRow);
                }}
                disabled={menuRow.isDefault || !menuRow.active}
                title={
                  menuRow.isDefault
                    ? "This is already the default hierarchy"
                    : !menuRow.active
                      ? "An inactive hierarchy cannot be the default"
                      : undefined
                }
                className={cn(
                  menuItemClass,
                  (menuRow.isDefault || !menuRow.active) &&
                    menuItemDisabledClass,
                )}
              >
                <Star className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium text-slate-500">
                  Set as Default
                </span>
              </button>
            )}
            {canManage && (
              <button
                onClick={() => {
                  if (menuRow.isDefault) return;
                  close();
                  setDeleteTarget(menuRow);
                }}
                disabled={menuRow.isDefault}
                title={
                  menuRow.isDefault
                    ? "The default hierarchy cannot be deleted"
                    : undefined
                }
                className={cn(
                  menuItemClass,
                  menuRow.isDefault && menuItemDisabledClass,
                )}
              >
                <Trash2 className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium text-slate-500">Delete Hierarchy</span>
              </button>
            )}
          </div>
        </PortalDropdownMenu>
      )}

      <AlertModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        type="warning"
        title="Delete Hierarchy"
        description={`Delete "${deleteTarget?.name ?? ""}" and its levels? This is recorded in the Audit Trail and cannot be undone.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        showCancel
      />

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Status"
          isExpanded={expandedSections.has("status")}
          onToggle={() => toggleSection("status")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setStatus(opt.value);
                  setPage(1);
                }}
                className={optionClass(status === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {status === opt.value && (
                  <Check size={16} className="text-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem
          label="Last Updated Range"
          isExpanded={expandedSections.has("updated")}
          onToggle={() => toggleSection("updated")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={updatedFrom}
              endDate={updatedTo}
              onStartDateChange={(value) => {
                setUpdatedFrom(value);
                setPage(1);
              }}
              onEndDateChange={(value) => {
                setUpdatedTo(value);
                setPage(1);
              }}
              placeholder="Select date range"
              autoApply
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
