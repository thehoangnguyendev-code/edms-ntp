import React, { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Plus,
  Download,
  Search,
  X,
  Copy,
  Eye,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Check,
} from "lucide-react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { AlertModal } from "@/components/ui/modal";
import { useNavigate } from "react-router-dom";
import { formatDateNumeric } from "@/utils/format";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { useNavigateWithLoading } from "@/hooks/useNavigateWithLoading";
import { SectionLoading, Loading } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import { emailTemplates } from "@/components/ui/breadcrumb/breadcrumbs.config";
import {
  DEFAULT_COLUMNS,
  EMAIL_TEMPLATE_TYPES,
  getEmailTemplateTypeConfig,
} from "./constants";
import { useEmailTemplatesList } from "./hooks/useEmailTemplatesList";
import { usePermissions } from "@/hooks/usePermissions";
import { DateRangePicker } from "@/components/ui/datetime-picker";
import {
  FilterDrawer,
  FilterAccordionItem,
} from "@/components/ui/filter/FilterDrawer";
import type { EmailTemplate, TableColumn } from "./types";
import { IconFilter2, IconPencilMinus } from "@tabler/icons-react";

export const EmailTemplatesView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAlias } = usePermissions();
  const canManageTemplates = hasPermissionAlias(
    "settings.email_template.manage",
  );
  const { navigateTo, isNavigating } = useNavigateWithLoading();

  const {
    currentEmailTemplates,
    totalItems,
    totalPages,
    startIndex,
    isLoading,
    isExporting,
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    updatedFrom,
    setUpdatedFrom,
    updatedTo,
    setUpdatedTo,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    sortConfig,
    handleSort,
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
    duplicateEmailTemplate,
    toggleTemplateStatus,
    clearFilters,
    exportEmailTemplates,
  } = useEmailTemplatesList();

  const [columns, setColumns] = useState<TableColumn[]>([...DEFAULT_COLUMNS]);
  const {
    openId: openDropdownId,
    position: dropdownPosition,
    getRef,
    toggle: handleDropdownToggle,
    close: closeDropdown,
  } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["type", "status", "createdDate", "updatedDate"]),
  );

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    template: null as EmailTemplate | null,
  });

  const [duplicateConfirm, setDuplicateConfirm] = useState(false);
  const [toggleConfirm, setToggleConfirm] = useState(false);
  const [activeMenuTemplate, setActiveMenuTemplate] =
    useState<EmailTemplate | null>(null);

  // Visible columns
  const visibleColumns = columns
    .filter((col) => col.visible)
    .sort((a, b) => a.order - b.order);

  // Handle actions
  const handleCreateTemplate = () => {
    navigateTo("/settings/email-templates/new");
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    navigateTo(`/settings/email-templates/edit/${template.id}`);
  };

  const handleDuplicateTemplate = (template: EmailTemplate) => {
    setActiveMenuTemplate(template);
    setDuplicateConfirm(true);
  };

  const handlePreviewTemplate = (template: EmailTemplate) => {
    navigateTo(`/settings/email-templates/preview/${template.id}`, {
      state: { template },
    });
  };

  const handleDeleteTemplate = (template: EmailTemplate) => {
    setDeleteModal({ isOpen: true, template });
  };

  const handleToggleStatus = (template: EmailTemplate) => {
    setActiveMenuTemplate(template);
    setToggleConfirm(true);
  };

  const confirmDuplicate = () => {
    if (activeMenuTemplate) {
      duplicateEmailTemplate(activeMenuTemplate.id);
      setDuplicateConfirm(false);
      setActiveMenuTemplate(null);
    }
  };

  const confirmToggleStatus = () => {
    if (activeMenuTemplate) {
      toggleTemplateStatus(activeMenuTemplate.id);
      setToggleConfirm(false);
      setActiveMenuTemplate(null);
    }
  };

  const confirmDelete = () => {
    if (deleteModal.template) {
      deleteEmailTemplate(deleteModal.template.id, deleteModal.template.name);
      setDeleteModal({ isOpen: false, template: null });
    }
  };

  const handleExportTemplates = async () => {
    await exportEmailTemplates();
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getOptionClassName = (isActive: boolean) =>
    cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
    );

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      {/* Header */}
      <PageHeader
        title="Email Templates"
        breadcrumbItems={emailTemplates()}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-2 whitespace-nowrap"
              onClick={handleExportTemplates}
              loading={isExporting}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            {canManageTemplates && (
              <Button
                size="sm"
                className="flex items-center gap-2 whitespace-nowrap"
                onClick={handleCreateTemplate}
              >
                <Plus className="h-4 w-4" />
                Create Template
              </Button>
            )}
          </>
        }
      />

      {/* Unified Content Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        {/* Filter Section */}
        <div className="px-4 pt-4 md:p-5 flex flex-col">
          <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
            <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
              <label className="text-xs sm:text-sm font-medium text-slate-700 block">
                Search
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors">
                    <Search className="h-4 w-4 text-slate-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name, subject, description..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setCurrentPage(1);
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

            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
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
                    placeholder="Search by name, subject, description..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Type Filter */}
              <Select
                label="Template Type"
                value={typeFilter}
                onChange={(value) => setTypeFilter(value as any)}
                options={[
                  { label: "All Types", value: "All" },
                  ...Object.keys(EMAIL_TEMPLATE_TYPES).map((key) => ({
                    label: getEmailTemplateTypeConfig(key).label,
                    value: key,
                  })),
                ]}
              />

              {/* Status Filter */}
              <Select
                label="Status"
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as any)}
                options={[
                  { label: "All Status", value: "All" },
                  { label: "Active", value: "Active" },
                  { label: "Inactive", value: "Inactive" },
                  { label: "Draft", value: "Draft" },
                ]}
              />

              {/* Created Date Range Filter */}
              <DateRangePicker
                label="Created Date Range"
                startDate={dateFrom}
                endDate={dateTo}
                onStartDateChange={setDateFrom}
                onEndDateChange={setDateTo}
                placeholder="Select date range"
              />

              {/* Updated Date Range Filter */}
              <DateRangePicker
                label="Updated Date Range"
                startDate={updatedFrom}
                endDate={updatedTo}
                onStartDateChange={setUpdatedFrom}
                onEndDateChange={setUpdatedTo}
                placeholder="Select date range"
              />

              <div className="flex items-end pb-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
          {isLoading && (
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300">
              <SectionLoading text="Loading templates..." minHeight="150px" />
            </div>
          )}

          <div
            className={cn(
              "border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300",
              isLoading && "blur-[2px] opacity-80",
            )}
          >
            {currentEmailTemplates.length > 0 ? (
              <>
                <div
                  ref={scrollerRef}
                  className={cn(
                    "flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400",
                    isDragging ? "cursor-grabbing select-none" : "cursor-grab",
                  )}
                  {...dragEvents}
                >
                  <table className="w-full min-w-max  border-spacing-0 text-left">
                    <thead>
                      <tr>
                        {visibleColumns.map((col) => {
                          const isSorted = sortConfig.key === col.id;
                          const canSort = !["no", "status"].includes(col.id);
                          return (
                            <th
                              key={col.id}
                              onClick={
                                canSort ? () => handleSort(col.id) : undefined
                              }
                              className={cn(
                                "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors",
                                canSort &&
                                  "cursor-pointer hover:bg-slate-100 hover:text-slate-700 group",
                              )}
                            >
                              <div className="flex items-center justify-between gap-2 w-full">
                                <span className="truncate">{col.label}</span>
                                {canSort && (
                                  <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                                    <ChevronUp
                                      className={cn(
                                        "h-3 w-3 -mb-1",
                                        isSorted &&
                                          sortConfig.direction === "asc"
                                          ? "text-emerald-600 font-bold"
                                          : "",
                                      )}
                                    />
                                    <ChevronDown
                                      className={cn(
                                        "h-3 w-3",
                                        isSorted &&
                                          sortConfig.direction === "desc"
                                          ? "text-emerald-600 font-bold"
                                          : "",
                                      )}
                                    />
                                  </div>
                                )}
                              </div>
                            </th>
                          );
                        })}
                        <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap text-center before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {currentEmailTemplates.map((template, index) => {
                        const tdClass =
                          "py-3 px-4 text-xs md:text-sm text-slate-700 border-b border-slate-200 whitespace-nowrap";

                        return (
                          <tr
                            key={template.id}
                            className="hover:bg-slate-50/80 transition-colors group"
                          >
                            {visibleColumns.map((col) => (
                              <td key={col.id} className={tdClass}>
                                {col.id === "no" && (
                                  <span className="text-slate-500 font-medium">
                                    {startIndex + index + 1}
                                  </span>
                                )}
                                {col.id === "status" && (
                                  <Badge
                                    color={
                                      template.status === "Active"
                                        ? "emerald"
                                        : template.status === "Inactive"
                                          ? "slate"
                                          : "amber"
                                    }
                                    size="sm"
                                    pill
                                  >
                                    {template.status}
                                  </Badge>
                                )}
                                {col.id === "type" && (
                                  <span className="text-slate-700">
                                    {
                                      getEmailTemplateTypeConfig(template.type)
                                        .label
                                    }
                                  </span>
                                )}
                                {col.id === "name" && (
                                  <span className="font-medium text-slate-900">
                                    {template.name}
                                  </span>
                                )}
                                {col.id === "subject" && (
                                  <span
                                    className="text-slate-700 max-w-48 truncate"
                                    title={template.subject}
                                  >
                                    {template.subject}
                                  </span>
                                )}
                                {col.id === "usageCount" && (
                                  <span className="text-slate-700 font-medium">
                                    {template.usageCount}
                                  </span>
                                )}
                                {col.id === "lastUsed" && (
                                  <span className="text-slate-700">
                                    {template.lastUsed
                                      ? formatDateNumeric(template.lastUsed)
                                      : "-"}
                                  </span>
                                )}
                                {col.id === "updatedDate" && (
                                  <span className="text-slate-700">
                                    {template.updatedDate
                                      ? formatDateNumeric(template.updatedDate)
                                      : formatDateNumeric(template.createdDate)}
                                  </span>
                                )}
                                {col.id === "createdBy" && (
                                  <span className="text-slate-700">
                                    {template.createdBy}
                                  </span>
                                )}
                              </td>
                            ))}
                            <td
                              onClick={(e) => e.stopPropagation()}
                              className="sticky right-0 z-10 bg-white border-b border-slate-200 py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors"
                            >
                              <button
                                ref={getRef(template.id)}
                                onClick={(e) =>
                                  handleDropdownToggle(template.id, e)
                                }
                                className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                              >
                                <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                  showItemCount={true}
                />
              </>
            ) : (
              <TableEmptyState
                title="No Email Templates Found"
                description="We couldn't find any email templates matching your filters. Try adjusting your search criteria or create a new template."
              />
            )}
          </div>
        </div>
      </div>

      {/* Portal Dropdown */}
      <PortalDropdownMenu
        isOpen={openDropdownId !== null}
        onClose={closeDropdown}
        position={dropdownPosition}
        minWidth={180}
      >
        {(() => {
          const t = currentEmailTemplates.find((t) => t.id === openDropdownId);
          if (!t) return null;
          const isActive = t.status === "Active";
          return (
            <div className="py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeDropdown();
                  handlePreviewTemplate(t);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <Eye className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium">Preview</span>
              </button>
              {canManageTemplates && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDropdown();
                    handleEditTemplate(t);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <IconPencilMinus className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">Edit Template</span>
                </button>
              )}
              {canManageTemplates && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDropdown();
                    handleDuplicateTemplate(t);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <Copy className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">Duplicate</span>
                </button>
              )}
              {canManageTemplates && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDropdown();
                    handleToggleStatus(t);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  {isActive ? (
                    <ToggleLeft className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ToggleRight className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  )}
                  <span className="font-medium">
                    {isActive ? "Deactivate" : "Activate"}
                  </span>
                </button>
              )}
              {canManageTemplates && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDropdown();
                    handleDeleteTemplate(t);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">Delete Template</span>
                </button>
              )}
            </div>
          );
        })()}
      </PortalDropdownMenu>

      {/* Duplicate Confirm Modal */}
      <AlertModal
        isOpen={duplicateConfirm}
        onClose={() => {
          setDuplicateConfirm(false);
          setActiveMenuTemplate(null);
        }}
        onConfirm={confirmDuplicate}
        type="confirm"
        title="Duplicate Template"
        description={`Create a copy of "${activeMenuTemplate?.name}"? The duplicate will be saved as a Draft.`}
        confirmText="Duplicate"
        cancelText="Cancel"
        showCancel
      />

      {/* Toggle Status Confirm Modal */}
      <AlertModal
        isOpen={toggleConfirm}
        onClose={() => {
          setToggleConfirm(false);
          setActiveMenuTemplate(null);
        }}
        onConfirm={confirmToggleStatus}
        type={activeMenuTemplate?.status === "Active" ? "warning" : "confirm"}
        title={
          activeMenuTemplate?.status === "Active"
            ? "Deactivate Template"
            : "Activate Template"
        }
        description={
          activeMenuTemplate?.status === "Active"
            ? `Are you sure you want to deactivate "${activeMenuTemplate?.name}"? It will no longer be available for use.`
            : `Are you sure you want to activate "${activeMenuTemplate?.name}"? It will become available for use.`
        }
        confirmText={
          activeMenuTemplate?.status === "Active" ? "Deactivate" : "Activate"
        }
        cancelText="Cancel"
        showCancel
      />

      {/* Delete Confirmation Modal */}
      <AlertModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, template: null })}
        onConfirm={confirmDelete}
        type="error"
        title="Delete Email Template"
        description={`Are you sure you want to delete "${deleteModal.template?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        showCancel
      />

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={() => {
          clearFilters();
          setCurrentPage(1);
        }}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Template Type"
          isExpanded={expandedSections.has("type")}
          onToggle={() => toggleSection("type")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Types", value: "All" },
              ...Object.keys(EMAIL_TEMPLATE_TYPES).map((key) => ({
                label: getEmailTemplateTypeConfig(key).label,
                value: key,
              })),
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setTypeFilter(opt.value as any);
                  setCurrentPage(1);
                }}
                className={getOptionClassName(typeFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {typeFilter === opt.value && (
                  <Check size={16} className="text-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Status"
          isExpanded={expandedSections.has("status")}
          onToggle={() => toggleSection("status")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Status", value: "All" },
              { label: "Active", value: "Active" },
              { label: "Inactive", value: "Inactive" },
              { label: "Draft", value: "Draft" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setStatusFilter(opt.value as any);
                  setCurrentPage(1);
                }}
                className={getOptionClassName(statusFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && (
                  <Check size={16} className="text-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Created Date Range"
          isExpanded={expandedSections.has("createdDate")}
          onToggle={() => toggleSection("createdDate")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={dateFrom}
              endDate={dateTo}
              onStartDateChange={(value) => {
                setDateFrom(value);
                setCurrentPage(1);
              }}
              onEndDateChange={(value) => {
                setDateTo(value);
                setCurrentPage(1);
              }}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Updated Date Range"
          isExpanded={expandedSections.has("updatedDate")}
          onToggle={() => toggleSection("updatedDate")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={updatedFrom}
              endDate={updatedTo}
              onStartDateChange={(value) => {
                setUpdatedFrom(value);
                setCurrentPage(1);
              }}
              onEndDateChange={(value) => {
                setUpdatedTo(value);
                setCurrentPage(1);
              }}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>

      {isNavigating && <Loading fullPage text="Loading..." />}
    </div>
  );
};
