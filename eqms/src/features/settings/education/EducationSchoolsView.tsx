import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import {
  Trash2, MoreVertical, School as SchoolIcon, Power, PowerOff, Search, AlertTriangle,
  ChevronUp, ChevronDown, Check, X, Plus,
} from "lucide-react";
import { Select } from "@/components/ui/select/Select";
import { cn } from "@/components/ui/utils";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { educationSchools as educationSchoolsBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";
import type { SchoolItem, SchoolType, SchoolOwnership } from "./types";
import { SCHOOL_TYPE_OPTIONS, SCHOOL_OWNERSHIP_OPTIONS } from "./types";
import { usePortalDropdown } from "@/hooks";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { IconFilter2, IconPencilMinus } from "@tabler/icons-react";
import { educationApi } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { extractApiMessage } from "../shared/utils";
import { useServerTable } from "../shared/hooks/useServerTable";
import { usePermissions } from "@/hooks/usePermissions";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";

const typeLabel = (type: string) => SCHOOL_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
const ownershipLabel = (ownership: string | null | undefined) => SCHOOL_OWNERSHIP_OPTIONS.find((o) => o.value === ownership)?.label ?? (ownership || "-");

/** Application Settings > Education > Schools -- universities, colleges, academies, vocational
 *  secondary schools, and trade schools in Vietnam. Its own page, not part of "Dictionaries". */
export const EducationSchoolsView: React.FC = () => {
  const navigate = useNavigate();
  const [resultModal, setResultModal] = useState<{ isOpen: boolean; type: "success" | "error"; title: string; description: string }>({
    isOpen: false, type: "success", title: "", description: "",
  });
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [typeFilter, setTypeFilter] = useState<"All" | SchoolType>("All");
  const [ownershipFilter, setOwnershipFilter] = useState<"All" | SchoolOwnership>("All");
  const [governanceFilter, setGovernanceFilter] = useState("All");
  const [originFilter, setOriginFilter] = useState("All");
  const [governingBodies, setGoverningBodies] = useState<string[]>([]);
  const [origins, setOrigins] = useState<string[]>([]);
  const { scrollerRef, dragEvents } = useTableDragScroll();
  const [modifiedFrom, setModifiedFrom] = useState("");
  const [modifiedTo, setModifiedTo] = useState("");
  const { openId: openDropdownId, position: dropdownPosition, getRef: getButtonRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("settings.education.school.manage");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status", "type", "ownership", "modifiedDate"]));
  const [selectedItem, setSelectedItem] = useState<SchoolItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const {
    searchQuery, setSearchQuery, currentPage, setCurrentPage, itemsPerPage, setItemsPerPage,
    totalPages, totalItems, items, isLoading, sortConfig, handleSort, reload,
  } = useServerTable<SchoolItem>({
    fetcher: educationApi.schools.page,
    defaultSortBy: "name",
    extraParams: { status: statusFilter, type: typeFilter === "All" ? undefined : typeFilter, ownership: ownershipFilter === "All" ? undefined : ownershipFilter, governingBody: governanceFilter === "All" ? undefined : governanceFilter, countryOfOriginName: originFilter === "All" ? undefined : originFilter, modifiedFrom: modifiedFrom || undefined, modifiedTo: modifiedTo || undefined },
  });

  React.useEffect(() => { educationApi.schools.filterOptions().then(({ governingBodies, origins }) => { setGoverningBodies(governingBodies); setOrigins(origins); }).catch(() => {}); }, []);

  const openResultModal = (type: "success" | "error", title: string, description: string) => setResultModal({ isOpen: true, type, title, description });
  const closeResultModal = () => setResultModal((prev) => ({ ...prev, isOpen: false }));

  React.useEffect(() => { setCurrentPage(1); }, [statusFilter, typeFilter, ownershipFilter, governanceFilter, originFilter, modifiedFrom, modifiedTo, setCurrentPage]);

  const handleEdit = (item: SchoolItem) => { navigate(`/settings/education/schools/${item.id}/edit`); closeDropdown(); };
  const handleDelete = (item: SchoolItem) => { setSelectedItem(item); setShowDeleteModal(true); closeDropdown(); };
  const handleRequestToggleStatus = (item: SchoolItem) => { setSelectedItem(item); setShowToggleModal(true); closeDropdown(); };

  const handleConfirmToggleStatus = () => {
    const item = selectedItem;
    if (!item) return;
    setIsSubmitting(true);
    educationApi.schools.update(item.id, { name: item.name, abbreviation: item.abbreviation, type: item.type, ownership: item.ownership, isActive: !item.isActive })
      .then((updated) => {
        setShowToggleModal(false);
        reload();
        showToast({ type: "success", title: updated.isActive ? "School Activated" : "School Deactivated", message: `"${updated.name}" was ${updated.isActive ? "activated" : "deactivated"} successfully.` });
      })
      .catch((error) => {
        setShowToggleModal(false);
        showToast({ type: "error", title: "Status Update Failed", message: extractApiMessage(error, "Unable to update school status.") });
      })
      .finally(() => setIsSubmitting(false));
  };

  const handleConfirmDelete = async () => {
    setIsSubmitting(true);
    try {
      if (selectedItem) {
        await educationApi.schools.remove(selectedItem.id);
        reload();
        showToast({ type: "success", title: "School Deleted", message: `"${selectedItem.name}" has been deleted successfully.` });
      }
      setShowDeleteModal(false);
      setSelectedItem(null);
    } catch (error) {
      showToast({ type: "error", title: "Delete Failed", message: extractApiMessage(error, "Unable to delete school.") });
      setShowDeleteModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => { setSearchQuery(""); setStatusFilter("All"); setTypeFilter("All"); setOwnershipFilter("All"); setGovernanceFilter("All"); setOriginFilter("All"); setModifiedFrom(""); setModifiedTo(""); setCurrentPage(1); };
  const toApiDate = (value: string) => {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
  };
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };
  const getOptionClassName = (isActive: boolean) =>
    cn("w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50");

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Schools"
        breadcrumbItems={educationSchoolsBreadcrumb(navigate)}
        actions={
          canManage ? (
            <Button size="sm" onClick={() => navigate("/settings/education/schools/new")} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Add New School
            </Button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col flex-1">
        <div className="px-4 pt-4 md:p-5 flex flex-col">
          <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
          <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" placeholder="Search schools..." value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full h-10 pl-10 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
                <IconFilter2 className="h-4 w-4" />Filters
              </Button>
            </div>
          </div>

          <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" placeholder="Search schools..." value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full h-9 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" />
                </div>
              </div>
              <div className="w-full">
                <Select label="Type" value={typeFilter}
                  onChange={(value) => { setTypeFilter(value as "All" | SchoolType); setCurrentPage(1); }}
                  options={[{ label: "All Types", value: "All" }, ...SCHOOL_TYPE_OPTIONS]}
                  placeholder="All Types" />
              </div>
              <div className="w-full">
                <Select label="Status" value={statusFilter}
                  onChange={(value) => { setStatusFilter(value as "All" | "Active" | "Inactive"); setCurrentPage(1); }}
                  options={[{ label: "All Status", value: "All" }, { label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }]}
                  placeholder="All Status" />
              </div>
              <div className="w-full">
                <Select label="Ownership" value={ownershipFilter}
                  onChange={(value) => { setOwnershipFilter(value as "All" | SchoolOwnership); setCurrentPage(1); }}
                  options={[{ label: "All Ownership", value: "All" }, ...SCHOOL_OWNERSHIP_OPTIONS]}
                  placeholder="All Ownership" />
              </div>
              <div className="w-full">
                <Select label="Governing Body" value={governanceFilter}
                  onChange={(value) => { setGovernanceFilter(value); setCurrentPage(1); }}
                  options={[{ label: "All Governing Bodies", value: "All" }, ...governingBodies.map((value) => ({ label: value, value }))]}
                  placeholder="All Governing Bodies" />
              </div>
              <div className="w-full">
                <Select label="Origin" value={originFilter}
                  onChange={(value) => { setOriginFilter(value); setCurrentPage(1); }}
                  options={[{ label: "All Origins", value: "All" }, ...origins.map((value) => ({ label: value, value }))]}
                  placeholder="All Origins" />
              </div>
              <DateRangePicker label="Modified Date Range" startDate={modifiedFrom} endDate={modifiedTo}
                onStartDateChange={(value) => setModifiedFrom(toApiDate(value))}
                onEndDateChange={(value) => setModifiedTo(toApiDate(value))}
                onApply={({ startDate, endDate }) => { setModifiedFrom(toApiDate(startDate)); setModifiedTo(toApiDate(endDate)); }}
                placeholder="Select date range" />
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={clearFilters} className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap">Clear Filters</Button>
            </div>
          </div>
        </div>
        </div>

        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[4px]">
              <SectionLoading text={searchQuery ? "Searching..." : "Loading schools..."} minHeight="150px" />
            </div>
          )}
        <div className={cn("flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white flex flex-col transition-all duration-300", isLoading && "blur-[2px] opacity-80")}>
          <div ref={scrollerRef} {...dragEvents} className="flex-1 overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-30">
                <tr>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-16">No.</th>
                  {[
                    { label: "School Name", id: "name" },
                    { label: "Abbreviation", id: "abbreviation" },
                    { label: "Type", id: "type", sortable: false },
                    { label: "Ownership", id: "ownership", sortable: false },
                    { label: "Governing Body", id: "governingBody" },
                    { label: "Origin", id: "countryOfOriginName" },
                    { label: "Status", id: "isActive" },
                    { label: "Modified Date", id: "modifiedDate" },
                  ].map((col) => {
                    const isSorted = sortConfig.key === col.id;
                    const isSortable = col.sortable !== false;
                    return (
                      <th key={col.id} onClick={() => isSortable && handleSort(col.id)}
                        className={cn(
                          "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors group",
                          isSortable && "cursor-pointer hover:bg-slate-100 hover:text-slate-700",
                        )}>
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="truncate">{col.label}</span>
                          {isSortable && (
                            <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                              <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === "asc" ? "text-emerald-600 font-bold" : "")} />
                              <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === "desc" ? "text-emerald-600 font-bold" : "")} />
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {isLoading ? (
                  <tr><td colSpan={10} className="py-14 text-center text-slate-500">Loading schools...</td></tr>
                ) : items.length > 0 ? (
                  items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700 text-center">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap font-medium text-slate-900">{item.name}</td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">{item.abbreviation || "-"}</td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap"><Badge color="blue" size="sm">{typeLabel(item.type)}</Badge></td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">{ownershipLabel(item.ownership)}</td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">{item.governingBody || item.directGoverningMinistry || "-"}</td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">{item.countryOfOriginName || "-"}</td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                        {item.isActive ? <Badge color="emerald" size="sm">Active</Badge> : <Badge color="slate" size="sm">Inactive</Badge>}
                      </td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{item.modifiedDate}</td>
                      <td onClick={(e) => e.stopPropagation()} className="sticky right-0 bg-white py-3 px-4 text-xs sm:text-sm text-center z-30 whitespace-nowrap before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50">
                        {canManage && (
                          <button ref={getButtonRef(item.id)} onClick={(e) => handleDropdownToggle(item.id, e)} className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors" aria-label="More actions">
                            <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="p-0">
                      <TableEmptyState
                       
                        title="No schools found"
                        description="Try adjusting your search"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && totalItems > 0 && (
            <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
          )}
        </div>
      </div>
      </div>

      <PortalDropdownMenu isOpen={openDropdownId !== null} onClose={closeDropdown} position={dropdownPosition} minWidth={180}>
        <div className="py-1">
          <button onClick={(e) => { e.stopPropagation(); const item = items.find((i) => i.id === openDropdownId)!; handleEdit(item); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
            <IconPencilMinus className="h-3.5 w-3.5" /><span>Edit School</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); const item = items.find((i) => i.id === openDropdownId)!; handleRequestToggleStatus(item); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
            {items.find((i) => i.id === openDropdownId)?.isActive ? (<><PowerOff className="h-3.5 w-3.5" /><span>Disable</span></>) : (<><Power className="h-3.5 w-3.5" /><span>Enable</span></>)}
          </button>
          <button onClick={(e) => { e.stopPropagation(); const item = items.find((i) => i.id === openDropdownId)!; handleDelete(item); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
            <Trash2 className="h-3.5 w-3.5" /><span>Delete</span>
          </button>
        </div>
      </PortalDropdownMenu>

      <AlertModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleConfirmDelete} type="warning"
        title="Delete School?"
        description={
          <div className="space-y-3">
            <p>Are you sure you want to delete <strong>{selectedItem?.name}</strong>?</p>
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-amber-700"><AlertTriangle className="h-3.5 w-3.5 text-amber-600 inline shrink-0" /> <span className="font-semibold">Warning:</span> This action cannot be undone.</p>
            </div>
          </div>
        }
        confirmText="Delete" cancelText="Cancel" isLoading={isSubmitting} showCancel />

      <AlertModal isOpen={showToggleModal} onClose={() => { setShowToggleModal(false); setSelectedItem(null); }} onConfirm={handleConfirmToggleStatus} type="warning"
        title={`${selectedItem?.isActive ? "Deactivate" : "Activate"} School?`}
        description={<p>Are you sure you want to {selectedItem?.isActive ? "deactivate" : "activate"} <strong>{selectedItem?.name}</strong>?</p>}
        confirmText={selectedItem?.isActive ? "Deactivate" : "Activate"} cancelText="Cancel" isLoading={isSubmitting} showCancel />

      <AlertModal isOpen={resultModal.isOpen} onClose={closeResultModal} onConfirm={closeResultModal} type={resultModal.type}
        title={resultModal.title} description={resultModal.description} confirmText="OK" showCancel={false} />

      <FilterDrawer isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} onClear={clearFilters} onApply={() => setIsFilterDrawerOpen(false)}>
        <FilterAccordionItem label="Type" isExpanded={expandedSections.has("type")} onToggle={() => toggleSection("type")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[{ label: "All Types", value: "All" }, ...SCHOOL_TYPE_OPTIONS].map((opt) => (
              <button key={opt.value} onClick={() => { setTypeFilter(opt.value as "All" | SchoolType); setCurrentPage(1); }} className={getOptionClassName(typeFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {typeFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[{ label: "All Status", value: "All" }, { label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }].map((opt) => (
              <button key={opt.value} onClick={() => { setStatusFilter(opt.value as "All" | "Active" | "Inactive"); setCurrentPage(1); }} className={getOptionClassName(statusFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Ownership" isExpanded={expandedSections.has("ownership")} onToggle={() => toggleSection("ownership")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[{ label: "All Ownership", value: "All" }, ...SCHOOL_OWNERSHIP_OPTIONS].map((opt) => (
              <button key={opt.value} onClick={() => { setOwnershipFilter(opt.value as "All" | SchoolOwnership); setCurrentPage(1); }} className={getOptionClassName(ownershipFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {ownershipFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Modified Date Range" isExpanded={expandedSections.has("modifiedDate")} onToggle={() => toggleSection("modifiedDate")}>
          <div className="pt-2 pb-4">
            <DateRangePicker label="" startDate={modifiedFrom} endDate={modifiedTo}
              onStartDateChange={(value) => setModifiedFrom(toApiDate(value))}
              onEndDateChange={(value) => setModifiedTo(toApiDate(value))}
              onApply={({ startDate, endDate }) => { setModifiedFrom(toApiDate(startDate)); setModifiedTo(toApiDate(endDate)); }}
              placeholder="Select date range" />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};

/** Small set, clean values seen across the seeded Vietnam institution data -- offered as a
 *  dropdown. Everything else below is genuinely free text: dozens of messy source-specific
 *  values (institution_type, governing_body_type, operational_status...) that don't fit a fixed
 *  enum, so the user types them directly. */
const ENTITY_KIND_OPTIONS = [
  { label: "Unspecified", value: "" },
  { label: "Institution", value: "institution" },
  { label: "International Program / Presence", value: "international_program_or_presence" },
];
const GOVERNANCE_MODEL_OPTIONS = [
  { label: "Unspecified", value: "" },
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
  { label: "Foreign / Other", value: "foreign_or_other" },
];

type SchoolFormData = {
  name: string;
  abbreviation: string;
  type: SchoolType;
  ownership: SchoolOwnership | "";
  isActive: boolean;
  entityKind: string;
  isIndependentInstitution: boolean;
  institutionType: string;
  institutionTypeLabel: string;
  presenceType: string;
  operationalStatus: string;
  verifiedAsOf: string;
  verificationStatus: string;
  governingBody: string;
  governingBodyType: string;
  governingBodyVerificationStatus: string;
  nationalEducationRegulator: string;
  governanceModel: string;
  directGoverningMinistry: string;
  countryOfOriginName: string;
  countryOfOriginIso2: string;
  hostInVietnam: string;
  parentOrPartner: string;
  supervisingAuthority: string;
  ultimateGoverningBody: string;
  ownershipVerificationStatus: string;
  statusNote: string;
  governingBodySourceUrls: string[];
};

const emptySchoolForm = (): SchoolFormData => ({
  name: "", abbreviation: "", type: "UNIVERSITY", ownership: "", isActive: true,
  entityKind: "", isIndependentInstitution: false, institutionType: "", institutionTypeLabel: "",
  presenceType: "", operationalStatus: "", verifiedAsOf: "", verificationStatus: "",
  governingBody: "", governingBodyType: "", governingBodyVerificationStatus: "",
  nationalEducationRegulator: "", governanceModel: "", directGoverningMinistry: "",
  countryOfOriginName: "", countryOfOriginIso2: "", hostInVietnam: "", parentOrPartner: "",
  supervisingAuthority: "", ultimateGoverningBody: "", ownershipVerificationStatus: "",
  statusNote: "", governingBodySourceUrls: [],
});

const schoolFormFromItem = (item: SchoolItem): SchoolFormData => ({
  name: item.name, abbreviation: item.abbreviation ?? "", type: item.type, ownership: item.ownership ?? "",
  isActive: item.isActive,
  entityKind: item.entityKind ?? "", isIndependentInstitution: item.isIndependentInstitution ?? false,
  institutionType: item.institutionType ?? "", institutionTypeLabel: item.institutionTypeLabel ?? "",
  presenceType: item.presenceType ?? "", operationalStatus: item.operationalStatus ?? "",
  verifiedAsOf: item.verifiedAsOf ?? "", verificationStatus: item.verificationStatus ?? "",
  governingBody: item.governingBody ?? "", governingBodyType: item.governingBodyType ?? "",
  governingBodyVerificationStatus: item.governingBodyVerificationStatus ?? "",
  nationalEducationRegulator: item.nationalEducationRegulator ?? "", governanceModel: item.governanceModel ?? "",
  directGoverningMinistry: item.directGoverningMinistry ?? "", countryOfOriginName: item.countryOfOriginName ?? "",
  countryOfOriginIso2: item.countryOfOriginIso2 ?? "", hostInVietnam: item.hostInVietnam ?? "",
  parentOrPartner: item.parentOrPartner ?? "", supervisingAuthority: item.supervisingAuthority ?? "",
  ultimateGoverningBody: item.ultimateGoverningBody ?? "", ownershipVerificationStatus: item.ownershipVerificationStatus ?? "",
  statusNote: item.statusNote ?? "", governingBodySourceUrls: item.governingBodySourceUrls ?? [],
});

interface SchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: SchoolItem | null;
  isEdit: boolean;
  onSave: (data: import("./types").SchoolPayload) => Promise<void>;
}

const fieldLabelClass = "block text-xs sm:text-sm font-medium text-slate-700 mb-1.5";
const fieldInputClass = "w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500";

const SchoolModal: React.FC<SchoolModalProps> = ({ isOpen, onClose, item, isEdit, onSave }) => {
  const [formData, setFormData] = useState<SchoolFormData>(() => (item ? schoolFormFromItem(item) : emptySchoolForm()));
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    setFormData(item ? schoolFormFromItem(item) : emptySchoolForm());
  }, [item, isOpen]);

  const setField = <K extends keyof SchoolFormData>(key: K, value: SchoolFormData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const updateSourceUrl = (index: number, value: string) =>
    setFormData((prev) => ({ ...prev, governingBodySourceUrls: prev.governingBodySourceUrls.map((u, i) => (i === index ? value : u)) }));
  const removeSourceUrl = (index: number) =>
    setFormData((prev) => ({ ...prev, governingBodySourceUrls: prev.governingBodySourceUrls.filter((_, i) => i !== index) }));
  const addSourceUrl = () =>
    setFormData((prev) => ({ ...prev, governingBodySourceUrls: [...prev.governingBodySourceUrls, ""] }));

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave({
        name: formData.name,
        abbreviation: formData.abbreviation || null,
        type: formData.type,
        ownership: formData.ownership || null,
        isActive: formData.isActive,
        entityKind: formData.entityKind || null,
        isIndependentInstitution: formData.isIndependentInstitution,
        institutionType: formData.institutionType || null,
        institutionTypeLabel: formData.institutionTypeLabel || null,
        presenceType: formData.presenceType || null,
        operationalStatus: formData.operationalStatus || null,
        verifiedAsOf: formData.verifiedAsOf || null,
        verificationStatus: formData.verificationStatus || null,
        governingBody: formData.governingBody || null,
        governingBodyType: formData.governingBodyType || null,
        governingBodyVerificationStatus: formData.governingBodyVerificationStatus || null,
        nationalEducationRegulator: formData.nationalEducationRegulator || null,
        governanceModel: formData.governanceModel || null,
        directGoverningMinistry: formData.directGoverningMinistry || null,
        countryOfOriginName: formData.countryOfOriginName || null,
        countryOfOriginIso2: formData.countryOfOriginIso2 || null,
        hostInVietnam: formData.hostInVietnam || null,
        parentOrPartner: formData.parentOrPartner || null,
        supervisingAuthority: formData.supervisingAuthority || null,
        ultimateGoverningBody: formData.ultimateGoverningBody || null,
        ownershipVerificationStatus: formData.ownershipVerificationStatus || null,
        statusNote: formData.statusNote || null,
        governingBodySourceUrls: formData.governingBodySourceUrls.filter((u) => u.trim() !== ""),
      });
      onClose();
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to save school", error);
    } finally {
      setIsSaving(false);
    }
  };

  const sectionTitleClass = "text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2 first:pt-0";

  return (
    <FormModal isOpen={isOpen} onClose={onClose} onConfirm={handleSubmit} title={`${isEdit ? "Edit" : "Add New"} School`} isLoading={isSaving} size="lg">
      <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
        <p className={sectionTitleClass}>Basic Information</p>
        <div>
          <label className={fieldLabelClass}>School Name<span className="text-red-500 ml-1">*</span></label>
          <input type="text" value={formData.name} onChange={(e) => setField("name", e.target.value)}
            className={fieldInputClass} placeholder="e.g., Đại học Bách khoa Hà Nội" required disabled={isSaving} />
        </div>
        <div>
          <label className={fieldLabelClass}>Abbreviation</label>
          <input type="text" value={formData.abbreviation} onChange={(e) => setField("abbreviation", e.target.value)}
            className={fieldInputClass} placeholder="e.g., HUST" disabled={isSaving} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabelClass}>Type<span className="text-red-500 ml-1">*</span></label>
            <Select value={formData.type} onChange={(value) => setField("type", value as SchoolType)} options={SCHOOL_TYPE_OPTIONS} />
          </div>
          <div>
            <label className={fieldLabelClass}>Ownership</label>
            <Select value={formData.ownership} onChange={(value) => setField("ownership", value as SchoolOwnership | "")}
              options={[{ label: "Unspecified", value: "" }, ...SCHOOL_OWNERSHIP_OPTIONS]} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="isActive-school" checked={formData.isActive} onChange={(checked) => setField("isActive", checked)} label="Active" disabled={isSaving} />
        </div>

        <p className={sectionTitleClass}>Classification</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabelClass}>Entity Kind</label>
            <Select value={formData.entityKind} onChange={(value) => setField("entityKind", value)} options={ENTITY_KIND_OPTIONS} />
          </div>
          <div className="flex items-end pb-1.5">
            <Checkbox id="isIndependent-school" checked={formData.isIndependentInstitution} onChange={(checked) => setField("isIndependentInstitution", checked)}
              label="Independent Institution" disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Institution Type</label>
            <input type="text" value={formData.institutionType} onChange={(e) => setField("institutionType", e.target.value)}
              className={fieldInputClass} placeholder="e.g., truong_dai_hoc, cao_dang, hoc_vien" disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Institution Type Label</label>
            <input type="text" value={formData.institutionTypeLabel} onChange={(e) => setField("institutionTypeLabel", e.target.value)}
              className={fieldInputClass} placeholder="Human-readable label" disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Presence Type</label>
            <input type="text" value={formData.presenceType} onChange={(e) => setField("presenceType", e.target.value)}
              className={fieldInputClass} placeholder="e.g., foreign_university_branch_or_foreign_owned" disabled={isSaving} />
          </div>
        </div>

        <p className={sectionTitleClass}>Status & Verification</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabelClass}>Operational Status</label>
            <input type="text" value={formData.operationalStatus} onChange={(e) => setField("operationalStatus", e.target.value)}
              className={fieldInputClass} placeholder="e.g., active, needs_recheck" disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Verified As Of</label>
            <input type="date" value={formData.verifiedAsOf} onChange={(e) => setField("verifiedAsOf", e.target.value)}
              className={fieldInputClass} disabled={isSaving} />
          </div>
          <div className="sm:col-span-2">
            <label className={fieldLabelClass}>Verification Status</label>
            <input type="text" value={formData.verificationStatus} onChange={(e) => setField("verificationStatus", e.target.value)}
              className={fieldInputClass} placeholder="e.g., verified_public_source" disabled={isSaving} />
          </div>
        </div>
        <div>
          <label className={fieldLabelClass}>Status Note</label>
          <textarea value={formData.statusNote} onChange={(e) => setField("statusNote", e.target.value)} rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Any free-text note about current status" disabled={isSaving} />
        </div>

        <p className={sectionTitleClass}>Governance</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabelClass}>Governing Body</label>
            <input type="text" value={formData.governingBody} onChange={(e) => setField("governingBody", e.target.value)}
              className={fieldInputClass} placeholder="e.g., Bộ Giáo dục và Đào tạo" disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Governing Body Type</label>
            <input type="text" value={formData.governingBodyType} onChange={(e) => setField("governingBodyType", e.target.value)}
              className={fieldInputClass} placeholder="e.g., ministry, local_government" disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Governing Body Verification Status</label>
            <input type="text" value={formData.governingBodyVerificationStatus} onChange={(e) => setField("governingBodyVerificationStatus", e.target.value)}
              className={fieldInputClass} disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Governance Model</label>
            <Select value={formData.governanceModel} onChange={(value) => setField("governanceModel", value)} options={GOVERNANCE_MODEL_OPTIONS} />
          </div>
          <div>
            <label className={fieldLabelClass}>National Education Regulator</label>
            <input type="text" value={formData.nationalEducationRegulator} onChange={(e) => setField("nationalEducationRegulator", e.target.value)}
              className={fieldInputClass} disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Direct Governing Ministry</label>
            <input type="text" value={formData.directGoverningMinistry} onChange={(e) => setField("directGoverningMinistry", e.target.value)}
              className={fieldInputClass} disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Supervising Authority</label>
            <input type="text" value={formData.supervisingAuthority} onChange={(e) => setField("supervisingAuthority", e.target.value)}
              className={fieldInputClass} disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Ultimate Governing Body</label>
            <input type="text" value={formData.ultimateGoverningBody} onChange={(e) => setField("ultimateGoverningBody", e.target.value)}
              className={fieldInputClass} disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Ownership Verification Status</label>
            <input type="text" value={formData.ownershipVerificationStatus} onChange={(e) => setField("ownershipVerificationStatus", e.target.value)}
              className={fieldInputClass} placeholder="e.g., needs_individual_verification" disabled={isSaving} />
          </div>
        </div>

        <p className={sectionTitleClass}>International</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabelClass}>Country of Origin</label>
            <input type="text" value={formData.countryOfOriginName} onChange={(e) => setField("countryOfOriginName", e.target.value)}
              className={fieldInputClass} placeholder="e.g., United Kingdom" disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Country of Origin (ISO2)</label>
            <input type="text" value={formData.countryOfOriginIso2} onChange={(e) => setField("countryOfOriginIso2", e.target.value.toUpperCase().slice(0, 2))}
              className={fieldInputClass} placeholder="e.g., GB" maxLength={2} disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Host in Vietnam</label>
            <input type="text" value={formData.hostInVietnam} onChange={(e) => setField("hostInVietnam", e.target.value)}
              className={fieldInputClass} placeholder="Vietnamese institution hosting this program" disabled={isSaving} />
          </div>
          <div>
            <label className={fieldLabelClass}>Parent / Partner</label>
            <input type="text" value={formData.parentOrPartner} onChange={(e) => setField("parentOrPartner", e.target.value)}
              className={fieldInputClass} disabled={isSaving} />
          </div>
        </div>

        <p className={sectionTitleClass}>Governance Sources</p>
        <div className="space-y-2">
          {formData.governingBodySourceUrls.map((url, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input type="text" value={url} onChange={(e) => updateSourceUrl(idx, e.target.value)}
                className={fieldInputClass} placeholder="https://..." disabled={isSaving} />
              <button type="button" onClick={() => removeSourceUrl(idx)} disabled={isSaving}
                className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addSourceUrl} disabled={isSaving}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700">
            <Plus className="h-3.5 w-3.5" /> Add source URL
          </button>
        </div>
      </div>
    </FormModal>
  );
};
