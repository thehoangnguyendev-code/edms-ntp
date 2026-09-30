import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, AlertTriangle, Ban, MoreVertical, X, Check, ChevronUp, ChevronDown } from "lucide-react";
import { IconFilter2, IconPencilMinus, IconTrash } from "@tabler/icons-react";
import { NavigationGuardModal } from "@/components/ui/modal/NavigationGuardModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useDocumentAdministration } from "@/features/settings/document-administration/hooks/useDocumentAdministration";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form/FormSection";
import { Badge } from "@/components/ui/badge/Badge";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast/Toast";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { TabNav } from "@/components/ui/tabs/TabNav";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { usePortalDropdown, useTableDragScroll, useDebounce } from "@/hooks";
import { cn } from "@/components/ui/utils";
import { settingsApi } from "@/services/api";
import type { SodConstraintResponse } from "@/services/api/settings";
import { segregationOfDuties as segregationOfDutiesBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { DocumentWorkflowRulesPanel } from "./DocumentWorkflowRulesPanel";
import { ROUTES } from "@/app/routes.constants";
import { formatDateTime } from "@/utils/format";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

// ─── Main View ────────────────────────────────────────────────────────────────
// Violation Scanner moved to its own screen: SodViolationReviewView.tsx (sibling to Access
// Review under Security & Authorization) -- keeps its own scan history for GxP self-inspection
// evidence, instead of a panel here with no persistence.

const TYPE_OPTIONS: SelectOption[] = [
  { label: "All Types", value: "ALL" },
  { label: "System", value: "SYSTEM" },
  { label: "Custom", value: "CUSTOM" },
];
const STATUS_OPTIONS: SelectOption[] = [
  { label: "All Status", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

const SOD_TABS: TabItem[] = [
  { id: "constraints", label: "Permission Conflict Rules" },
  { id: "document-rules", label: "Document Revision Integrity" },
];

export const SegregationOfDutiesView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canViewSod = hasPermissionAlias("security.sod.view");
  const canManageSod = hasPermissionAlias("security.sod.manage");
  const canManageDocumentWorkflowRules = hasPermissionAlias("security.sod.manage");
  const [activeTab, setActiveTab] = useState<"constraints" | "document-rules">("constraints");
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const { requestSignature, signatureModal } = useSecurityESign();

  // Document Workflow Rules tab — state lifted here so Edit/Cancel/Reset/Save
  // Changes render in the shared PageHeader (same row as every other screen's
  // primary actions) instead of inside the tab panel itself.
  const [isEditingDocRules, setIsEditingDocRules] = useState(false);
  const {
    isLoading: isDocRulesLoading,
    isDirty: isDocRulesDirty,
    setIsDirty: setIsDocRulesDirty,
    sodRules: docWorkflowRules,
    setSodRules: setDocWorkflowRules,
    sodRuleDefinitions: docWorkflowRuleDefinitions,
    resetAdministration,
    saveAdministration,
  } = useDocumentAdministration();
  const [showDocRulesResetModal, setShowDocRulesResetModal] = useState(false);
  const [showDocRulesESignModal, setShowDocRulesESignModal] = useState(false);
  const handleCancelDocRulesEdit = () => {
    if (isDocRulesDirty) setShowDocRulesResetModal(true);
    else setIsEditingDocRules(false);
  };
  const handleDocRulesReset = () => {
    resetAdministration();
    setShowDocRulesResetModal(false);
    setIsEditingDocRules(false);
  };
  const handleDocRulesSave = async (data: { reason: string; signatureToken: string }) => {
    try {
      await saveAdministration(data.reason, data.signatureToken);
      setShowDocRulesESignModal(false);
      setIsEditingDocRules(false);
      showToast({ type: "success", message: "Document revision integrity rules updated." });
    } catch (error: any) {
      showToast({ type: "error", message: error?.response?.data?.message ?? "Unable to update revision integrity rules." });
    }
  };
  const docRulesSignatureChanges = docWorkflowRuleDefinitions.map((rule) => ({
    action: rule.label,
    oldValue: "Previous Configuration",
    newValue: docWorkflowRules[rule.code] ? "Enabled" : "Disabled",
    category: "metadata" as const,
  }));

  const [constraints, setConstraints] = useState<SodConstraintResponse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SodConstraintResponse | null>(null);

  // Server-side query state.
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Severity options from the server.
  const [severities, setSeverities] = useState<string[]>([]);

  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["severity"]));

  const load = useCallback(async () => {
    if (!canViewSod) {
      setConstraints([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await settingsApi.listSodConstraintsPaged({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        severity: severityFilter !== "ALL" ? severityFilter : undefined,
        type: typeFilter !== "ALL" ? typeFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        updatedFrom: updatedFrom || undefined,
        updatedTo: updatedTo || undefined,
        sortBy: sortKey,
        sortDir,
      });
      setConstraints(res.data ?? []);
      setTotalItems(res.pagination?.total ?? 0);
      setTotalPages(res.pagination?.totalPages ?? 1);
    } catch {
      showToast({ type: "error", message: "Failed to load SoD constraints" });
    } finally {
      setLoading(false);
    }
  }, [canViewSod, currentPage, itemsPerPage, debouncedSearch, severityFilter, typeFilter, statusFilter, createdFrom, createdTo, updatedFrom, updatedTo, sortKey, sortDir, showToast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!canViewSod) return;
    settingsApi.getSodListOptions()
      .then((o) => setSeverities(o.severities ?? []))
      .catch(() => setSeverities([]));
  }, [canViewSod]);

  const severityOptions: SelectOption[] = [
    { label: "All Severities", value: "ALL" },
    ...severities.map((sv) => ({ label: sv, value: sv })),
  ];

  const hasFilters = !!search || severityFilter !== "ALL" || typeFilter !== "ALL" || statusFilter !== "ALL" || !!createdFrom || !!createdTo || !!updatedFrom || !!updatedTo;
  const clearFilters = () => {
    setSearch("");
    setSeverityFilter("ALL");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setCreatedFrom("");
    setCreatedTo("");
    setUpdatedFrom("");
    setUpdatedTo("");
    setCurrentPage(1);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const toggleSection = (id: string) => setExpandedSections((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const sig = await requestSignature(`Delete SoD Constraint "${deleteTarget.name}"`, "SoD Rule Change");
    if (!sig) return;
    try {
      await settingsApi.deleteSodConstraint(deleteTarget.id, sig);
      showToast({ type: "success", message: "Constraint deleted" });
      setDeleteTarget(null);
      void load();
    } catch (e: any) {
      showToast({ type: "error", message: e?.response?.data?.message ?? "Delete failed" });
    }
  };

  const filterOptionClass = (isActive: boolean) =>
    cn(
      "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
      isActive
        ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
        : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300",
    );

  const sortableTh = (key: string, label: string) => (
    <TableMarkup.HeaderCell
      key={key}
      onClick={() => handleSort(key)}
      className={TABLE_STYLES.headerCell38}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="truncate">{label}</span>
        <div className="flex flex-col text-slate-400 flex-shrink-0 group-hover:text-slate-500">
          <ChevronUp className={cn("h-3 w-3 -mb-1", sortKey === key && sortDir === "asc" ? "text-emerald-600" : "")} />
          <ChevronDown className={cn("h-3 w-3", sortKey === key && sortDir === "desc" ? "text-emerald-600" : "")} />
        </div>
      </div>
    </TableMarkup.HeaderCell>
  );

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      <PageHeader
        title="Segregation of Duties"
        breadcrumbItems={segregationOfDutiesBreadcrumb(
          navigate,
          SOD_TABS.find((tab) => tab.id === activeTab)?.label,
        )}
        actions={
          activeTab === "constraints" ? (
            canManageSod ? (
              <Button size="sm" className="whitespace-nowrap gap-2" onClick={() => navigate(`${ROUTES.SECURITY.SOD}/new`)}>
                <Plus className="h-4 w-4" />
                New Constraint
              </Button>
            ) : undefined
          ) : !isEditingDocRules ? (
            <Button
              size="sm"
              className="whitespace-nowrap gap-2"
              onClick={() => canManageDocumentWorkflowRules && setIsEditingDocRules(true)}
              disabled={!canManageDocumentWorkflowRules}
            >
              <IconPencilMinus className="h-4 w-4" />
              Edit Revision Integrity Rules
            </Button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={handleCancelDocRulesEdit}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
                onClick={() => setShowDocRulesResetModal(true)}
                disabled={!isDocRulesDirty}
              >
                Reset
              </Button>
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
                onClick={() => setShowDocRulesESignModal(true)}
                disabled={!isDocRulesDirty}
              >
                Save Changes
              </Button>
            </div>
          )
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <TabNav
          tabs={SOD_TABS}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as "constraints" | "document-rules")}
          variant="underline"
        />

        <div className="p-4 md:p-5 flex-1 flex flex-col">
      {activeTab === "document-rules" ? (
        <DocumentWorkflowRulesPanel
          isLoading={isDocRulesLoading}
          isEditing={isEditingDocRules}
          canManage={canManageDocumentWorkflowRules}
          sodRules={docWorkflowRules}
          setSodRules={setDocWorkflowRules}
          sodRuleDefinitions={docWorkflowRuleDefinitions}
          setIsDirty={setIsDocRulesDirty}
        />
      ) : !canViewSod ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
          <TableEmptyState title="Permission denied" description="You do not have permission to view segregation-of-duties constraints." />
        </div>
      ) : (
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="w-full flex-1 flex flex-col">

              {/* Mobile: search + filter drawer */}
              <div className="flex md:hidden items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    placeholder="Search constraints…"
                    className="w-full pl-9 pr-8 h-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                  {search && (
                    <button onClick={() => { setSearch(""); setCurrentPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
                  <IconFilter2 className="h-4 w-4" />
                  Filters
                </Button>
              </div>

              {/* Desktop filters */}
              <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
                <div className="w-full">
                  <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                      placeholder="Search constraints…"
                      className="w-full pl-9 pr-3 h-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <Select label="Severity" value={severityFilter} onChange={(v) => { setSeverityFilter(String(v)); setCurrentPage(1); }} options={severityOptions} />
                <Select label="Type" value={typeFilter} onChange={(v) => { setTypeFilter(String(v)); setCurrentPage(1); }} options={TYPE_OPTIONS} />
                <Select label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(String(v)); setCurrentPage(1); }} options={STATUS_OPTIONS} />
                <DateRangePicker label="Created Date Range" startDate={createdFrom} endDate={createdTo} onStartDateChange={(value) => { setCreatedFrom(value); setCurrentPage(1); }} onEndDateChange={(value) => { setCreatedTo(value); setCurrentPage(1); }} placeholder="Select created date range" autoApply />
                <DateRangePicker label="Last Updated Range" startDate={updatedFrom} endDate={updatedTo} onStartDateChange={(value) => { setUpdatedFrom(value); setCurrentPage(1); }} onEndDateChange={(value) => { setUpdatedTo(value); setCurrentPage(1); }} placeholder="Select last updated range" autoApply />
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

              <div className="flex-1 flex flex-col relative">
                {loading && (
                  <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center rounded-xl">
                    <SectionLoading minHeight="150px" />
                  </div>
                )}
                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white">
              <div
                ref={scrollerRef as React.RefObject<HTMLDivElement>}
                className={cn("overflow-x-auto", isDragging ? "cursor-grabbing select-none" : "cursor-grab")}
                {...dragEvents}
              >
                <TableMarkup.Root className="w-full min-w-[820px]">
                  <TableMarkup.Head className="sticky top-0 z-30">
                    <TableMarkup.Row>
                      <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell33}>No.</TableMarkup.HeaderCell>
                      {sortableTh("name", "Constraint")}
                      {sortableTh("permissionCodeA", "Permission A")}
                      {sortableTh("permissionCodeB", "Permission B")}
                      {sortableTh("severity", "Severity")}
                      {sortableTh("updatedAt", "Last Updated")}
                      <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell26}>
                        Action
                      </TableMarkup.HeaderCell>
                    </TableMarkup.Row>
                  </TableMarkup.Head>
                  <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                    {!loading && constraints.length === 0 ? (
                      <TableMarkup.Row>
                        <TableMarkup.Cell colSpan={7} className="p-0">
                          <TableEmptyState
                           
                            title="No SoD Constraints"
                            description={hasFilters ? "Try adjusting your search or filters." : "No Segregation of Duties constraints have been defined yet."}
                          />
                        </TableMarkup.Cell>
                      </TableMarkup.Row>
                    ) : (
                      constraints.map((c, idx) => (
                        <TableMarkup.Row key={c.id} className={cn("hover:bg-slate-50/80 transition-colors group", !c.active && "opacity-50")}>
                          <TableMarkup.Cell className={TABLE_STYLES.cell29}>
                            {(currentPage - 1) * itemsPerPage + idx + 1}
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <div className="font-medium text-slate-800">{c.name}</div>
                            {c.regulationRef && <div className="text-xs text-slate-400 mt-0.5">{c.regulationRef}</div>}
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <div className="font-medium text-slate-800">{c.permissionNameA}</div>
                            <div className="text-2xs text-slate-400 mt-0.5 font-mono">{c.permissionCodeA}</div>
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <div className="font-medium text-slate-800">{c.permissionNameB}</div>
                            <div className="text-2xs text-slate-400 mt-0.5 font-mono">{c.permissionCodeB}</div>
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                semantic={c.severity === "BLOCK" ? "danger" : "warning"}
                                size="sm"
                                icon={c.severity === "BLOCK"
                                  ? <Ban className="h-3.5 w-3.5" />
                                  : <AlertTriangle className="h-3.5 w-3.5" />}
                              >
                                {c.severity}
                              </Badge>
                              {c.system && <Badge color="blue" size="xs">System</Badge>}
                            </div>
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{formatDateTime(c.updatedAt)}</TableMarkup.Cell>
                          <TableMarkup.Cell
                            onClick={(e) => e.stopPropagation()}
                            className={TABLE_STYLES.emptyCell2}
                          >
                            <button
                              ref={getRef(c.id)}
                              onClick={(e) => toggle(c.id, e)}
                              className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
                              aria-label="More actions"
                            >
                              <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                            </button>
                            <PortalDropdownMenu isOpen={openId === c.id} onClose={close} position={position}>
                              <div className="py-1">
                                {canManageSod && (
                                  <>
                                    <DropdownMenuItem
                                      icon={<IconPencilMinus className="h-4 w-4" />}
                                      onClick={() => {
                                        navigate(`${ROUTES.SECURITY.SOD}/${c.id}/edit`);
                                        close();
                                      }}
                                    >
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      icon={<IconTrash className="h-4 w-4" />}
                                      onClick={() => {
                                        setDeleteTarget(c);
                                        close();
                                      }}
                                      disabled={c.system}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </div>
                            </PortalDropdownMenu>
                          </TableMarkup.Cell>
                        </TableMarkup.Row>
                      ))
                    )}
                  </TableMarkup.Body>
                </TableMarkup.Root>
              </div>

              {totalItems > 0 && (
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
              )}
                </div>
              </div>
        </div>
        </div>
      )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem label="Created Date Range" isExpanded={expandedSections.has("createdDate")} onToggle={() => toggleSection("createdDate")}>
          <div className="pt-1 pb-4"><DateRangePicker label="Created Date Range" startDate={createdFrom} endDate={createdTo} onStartDateChange={(value) => { setCreatedFrom(value); setCurrentPage(1); }} onEndDateChange={(value) => { setCreatedTo(value); setCurrentPage(1); }} placeholder="Select created date range" autoApply /></div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Last Updated Range" isExpanded={expandedSections.has("updatedDate")} onToggle={() => toggleSection("updatedDate")}>
          <div className="pt-1 pb-4"><DateRangePicker label="Last Updated Range" startDate={updatedFrom} endDate={updatedTo} onStartDateChange={(value) => { setUpdatedFrom(value); setCurrentPage(1); }} onEndDateChange={(value) => { setUpdatedTo(value); setCurrentPage(1); }} placeholder="Select last updated range" autoApply /></div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Severity" isExpanded={expandedSections.has("severity")} onToggle={() => toggleSection("severity")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {severityOptions.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setSeverityFilter(String(opt.value)); setCurrentPage(1); }} className={filterOptionClass(severityFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {severityFilter === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Type" isExpanded={expandedSections.has("type")} onToggle={() => toggleSection("type")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {TYPE_OPTIONS.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setTypeFilter(String(opt.value)); setCurrentPage(1); }} className={filterOptionClass(typeFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {typeFilter === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {STATUS_OPTIONS.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setStatusFilter(String(opt.value)); setCurrentPage(1); }} className={filterOptionClass(statusFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>

      <AlertModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        type="warning"
        title="Delete SoD Constraint"
        description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ""}
        confirmText="Delete"
        cancelText="Cancel"
        showCancel
      />

      <NavigationGuardModal
        isOpen={showDocRulesResetModal}
        onClose={() => setShowDocRulesResetModal(false)}
        onConfirm={handleDocRulesReset}
        mode="discard"
        currentPageTitle="Document Revision Integrity Rules"
        title="Discard unsaved changes?"
        primaryActionLabel="Discard changes"
        secondaryActionLabel="Keep editing"
        description={
          <div className="text-sm text-slate-600">
            All unsaved changes to document revision integrity rules will be lost.
          </div>
        }
      />

      <ESignatureModal
        isOpen={showDocRulesESignModal}
        onClose={() => setShowDocRulesESignModal(false)}
        onConfirm={handleDocRulesSave}
        actionTitle="Update Document Revision Integrity Rules"
        changes={docRulesSignatureChanges}
      />

      {signatureModal}
    </div>
  );
};
