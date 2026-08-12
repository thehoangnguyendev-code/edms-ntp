import React, { useState, useMemo } from "react";
import { History, Search, Monitor, Info, Check, X } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { parseDMYStart, parseDMYEnd } from "@/lib/date";
import { Button } from "@/components/ui/button/Button";
import { Select, SelectOption } from "@/components/ui/select/Select";
import { FormModal } from "@/components/ui/modal/FormModal";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { useTableDragScroll, useNavigateWithLoading } from "@/hooks";
import { USER_MANAGEMENT_ROUTES } from "@/features/security-authorization/user-management/constants";
import { IconFilter2 } from "@tabler/icons-react";
import {
  MATERIAL_TAB_AUDIT_ACTION_OPTIONS,
  MATERIAL_TAB_AUDIT_MOCK_DATA,
  type MaterialAuditEntry,
} from "./materialTabMockData";
import { formatAuditActionLabel } from "@/features/audit-trail/utils/actionBadge";

interface MaterialAuditTrailTabProps {
  mockData?: MaterialAuditEntry[];
  actionOptions?: SelectOption[];
  emptyMessage?: string;
}

export const MaterialAuditTrailTab: React.FC<MaterialAuditTrailTabProps> = ({
  mockData = MATERIAL_TAB_AUDIT_MOCK_DATA,
  actionOptions = MATERIAL_TAB_AUDIT_ACTION_OPTIONS,
  emptyMessage = "No audit trail records available for this material"
}) => {
  const { navigateTo } = useNavigateWithLoading();
  const [selectedAction, setSelectedAction] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<MaterialAuditEntry | null>(null);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["action", "user", "department", "date"]));
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  const userOptions = useMemo(() => {
    const users = new Set<string>();
    mockData.forEach((entry) => users.add(entry.user.fullName));
    return [
      { value: "all", label: "All Users" },
      ...Array.from(users).map((user) => ({ value: user, label: user }))
    ];
  }, [mockData]);

  const departmentOptions = useMemo(() => {
    const departments = new Set<string>();
    mockData.forEach((entry) => departments.add(entry.user.department));
    return [
      { value: "all", label: "All Departments" },
      ...Array.from(departments).map((dept) => ({ value: dept, label: dept }))
    ];
  }, [mockData]);

  const filteredData = mockData.filter((entry) => {
    const matchesAction = selectedAction === "all" || entry.actionType === selectedAction;
    const matchesSearch =
      entry.user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.user.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUser = selectedUser === "all" || entry.user.fullName === selectedUser;
    const matchesDepartment = selectedDepartment === "all" || entry.user.department === selectedDepartment;

    const entryDate = new Date(entry.timestamp);
    let matchesDateFrom = true;
    let matchesDateTo = true;

    if (dateFrom) {
      const from = parseDMYStart(dateFrom);
      if (from) matchesDateFrom = entryDate >= from;
    }
    if (dateTo) {
      const to = parseDMYEnd(dateTo);
      if (to) matchesDateTo = entryDate <= to;
    }

    return matchesAction && matchesSearch && matchesUser && matchesDepartment &&
      matchesDateFrom && matchesDateTo;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getActionBadge = (actionType: string) => {
    const styles: Record<string, string> = {
      create: "bg-blue-50 text-blue-700 border-blue-200",
      edit: "bg-amber-50 text-amber-700 border-amber-200",
      review: "bg-purple-50 text-purple-700 border-purple-200",
      approve: "bg-emerald-50 text-emerald-700 border-emerald-200",
      reject: "bg-red-50 text-red-700 border-red-200",
      download: "bg-emerald-50 text-emerald-700 border-emerald-200",
      print: "bg-slate-50 text-slate-700 border-slate-200",
      view: "bg-slate-50 text-slate-600 border-slate-200",
      request: "bg-blue-50 text-blue-700 border-blue-200",
      distribute: "bg-cyan-50 text-cyan-700 border-cyan-200",
      obsolete: "bg-amber-50 text-amber-700 border-amber-200",
      cancel: "bg-red-50 text-red-700 border-red-200",
    };
    return styles[actionType] || styles.view;
  };

  const openChangesModal = (entry: MaterialAuditEntry) => {
    setSelectedEntry(entry);
    setShowChangesModal(true);
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

  const handleClearFilters = () => {
    setSelectedAction("all");
    setSelectedUser("all");
    setSelectedDepartment("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const getOptionClassName = (isActive: boolean) =>
    cn(
      "flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-left w-full",
      isActive
        ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
        : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-200"
    );

  const hasActiveFilters =
    selectedAction !== "all" ||
    selectedUser !== "all" ||
    selectedDepartment !== "all" ||
    dateFrom ||
    dateTo;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white w-full mb-4 md:mb-5">
        <div className="flex md:hidden flex-col gap-1.5 w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by user or action..."
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
              className="whitespace-nowrap gap-2 h-10"
            >
              <IconFilter2 className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>

        <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-2 xl:col-span-4 w-full">
            <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by user or action..."
                className="block w-full pl-10 pr-3 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="xl:col-span-4 w-full">
            <Select
              label="Action Type"
              value={selectedAction}
              onChange={(value) => {
                setSelectedAction(value as string);
                setCurrentPage(1);
              }}
              options={actionOptions}
              placeholder="All Actions"
            />
          </div>

          <div className="xl:col-span-4 w-full">
            <Select
              label="User"
              value={selectedUser}
              onChange={(value) => {
                setSelectedUser(value as string);
                setCurrentPage(1);
              }}
              options={userOptions}
              placeholder="All Users"
            />
          </div>

          <div className="xl:col-span-4 w-full">
            <Select
              label="Department"
              value={selectedDepartment}
              onChange={(value) => {
                setSelectedDepartment(value as string);
                setCurrentPage(1);
              }}
              options={departmentOptions}
              placeholder="All Departments"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-4 w-full">
            <DateRangePicker
              label="Timestamp Date Range"
              startDate={dateFrom}
              endDate={dateTo}
              onStartDateChange={(dateStr) => {
                setDateFrom(dateStr);
                setCurrentPage(1);
              }}
              onEndDateChange={(dateStr) => {
                setDateTo(dateStr);
                setCurrentPage(1);
              }}
              placeholder="Select date range"
              includeTime={true}
            />
          </div>

          {hasActiveFilters && (
            <div className="md:col-span-2 xl:col-span-12 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>

        <FilterDrawer
          isOpen={isFilterDrawerOpen}
          onClose={() => setIsFilterDrawerOpen(false)}
          onClear={handleClearFilters}
          onApply={() => setIsFilterDrawerOpen(false)}
        >
          <FilterAccordionItem
            label="Action Type"
            isExpanded={expandedSections.has("action")}
            onToggle={() => toggleSection("action")}
          >
            <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
              {actionOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setSelectedAction(String(opt.value));
                    setCurrentPage(1);
                  }}
                  className={getOptionClassName(selectedAction === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {selectedAction === opt.value && <Check size={16} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </FilterAccordionItem>

          <FilterAccordionItem
            label="User"
            isExpanded={expandedSections.has("user")}
            onToggle={() => toggleSection("user")}
          >
            <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
              {userOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setSelectedUser(opt.value);
                    setCurrentPage(1);
                  }}
                  className={getOptionClassName(selectedUser === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {selectedUser === opt.value && <Check size={16} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </FilterAccordionItem>

          <FilterAccordionItem
            label="Department"
            isExpanded={expandedSections.has("department")}
            onToggle={() => toggleSection("department")}
          >
            <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
              {departmentOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setSelectedDepartment(opt.value);
                    setCurrentPage(1);
                  }}
                  className={getOptionClassName(selectedDepartment === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {selectedDepartment === opt.value && <Check size={16} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </FilterAccordionItem>

          <FilterAccordionItem
            label="Timestamp Date Range"
            isExpanded={expandedSections.has("date")}
            onToggle={() => toggleSection("date")}
          >
            <div className="pt-2 pb-4">
              <DateRangePicker
                label="Timestamp Date Range"
                startDate={dateFrom}
                endDate={dateTo}
                onStartDateChange={(dateStr) => {
                  setDateFrom(dateStr);
                  setCurrentPage(1);
                }}
                onEndDateChange={(dateStr) => {
                  setDateTo(dateStr);
                  setCurrentPage(1);
                }}
                placeholder="Select date range"
                includeTime={true}
              />
            </div>
          </FilterAccordionItem>
        </FilterDrawer>
      </div>

      <div className="flex-1 overflow-hidden border rounded-xl bg-white shadow-sm flex flex-col">
        <div
          ref={scrollerRef}
          {...dragEvents}
          className={cn(
            "overflow-x-auto flex-1",
            isDragging ? "cursor-grabbing select-none" : "cursor-grab"
          )}
        >
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-30">
              <tr>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3.5 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-10 sm:w-16">No.</th>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3.5 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3.5 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">User</th>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3.5 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Employee ID</th>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3.5 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Position</th>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3.5 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Department</th>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3.5 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Action</th>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3.5 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Changes</th>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3.5 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Reason</th>
                <th className="px-2 py-2.5 sm:px-4 sm:py-3.5 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">IP / Device</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <History className="h-12 w-12 text-slate-300" />
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-slate-700">No audit entries found</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {searchQuery || selectedAction !== "all"
                            ? "Try adjusting your filters or search query"
                            : emptyMessage}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((entry, index) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap text-center">
                      <div className="text-xs sm:text-sm text-slate-500 font-medium">{(currentPage - 1) * itemsPerPage + index + 1}</div>
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-medium text-slate-700">
                          {entry.timestamp.split(" ")[0]}
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-slate-700">
                          {entry.timestamp.split(" ")[1]}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-slate-900">{entry.user.fullName}</div>
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">
                      <div
                        className="text-xs sm:text-sm font-medium text-emerald-600 cursor-pointer hover:underline"
                        onClick={() => navigateTo(USER_MANAGEMENT_ROUTES.PROFILE(entry.user.id))}
                      >
                        {entry.user.employeeCode}
                      </div>
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm text-slate-600">{entry.user.position}</div>
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm text-slate-500">{entry.user.department}</div>
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-2xs font-medium border",
                        getActionBadge(entry.actionType)
                      )}>
                        {formatAuditActionLabel(entry.action)}
                      </span>
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">
                      {entry.changes && entry.changes.length > 0 ? (
                        <button
                          onClick={() => openChangesModal(entry)}
                          className="flex items-center gap-1.5 text-xs sm:text-sm text-emerald-600 hover:text-emerald-700 hover:underline"
                        >
                          {entry.changes.length} field{entry.changes.length > 1 ? "s" : ""} changed
                        </button>
                      ) : (
                        <span className="text-xs sm:text-sm text-slate-400">No changes</span>
                      )}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">
                      {entry.reason ? (
                        <p className="text-xs sm:text-sm text-slate-700">{entry.reason}</p>
                      ) : (
                        <span className="text-xs sm:text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-4 whitespace-nowrap">
                      <div className="flex items-start gap-1.5 sm:gap-2">
                        <Monitor className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-2xs text-slate-700">{entry.ipAddress}</div>
                          <div className="text-2xs text-slate-500 mt-0.5">{entry.device}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredData.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      </div>

      <FormModal
        isOpen={showChangesModal}
        onClose={() => setShowChangesModal(false)}
        title="Change Details"
        description={selectedEntry && (
          <span className="text-sm text-slate-600 mt-0.5">
            {formatAuditActionLabel(selectedEntry.action)} by {selectedEntry.user.fullName} on {selectedEntry.timestamp}
          </span>
        )}
        confirmText="Close"
        onConfirm={() => setShowChangesModal(false)}
        showCancel={false}
        size="xl"
      >
        {selectedEntry && (
          <>
            {selectedEntry.changes && selectedEntry.changes.length > 0 ? (
              <div className="space-y-4">
                {selectedEntry.changes.map((change, index) => (
                  <div key={index} className="border border-slate-200 bg-slate-50/30 rounded-xl p-3.5 sm:p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <div className="text-xs sm:text-sm font-semibold text-slate-900 tracking-tight">{change.field}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="text-2xs uppercase tracking-wider font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Old Value
                          </div>
                          <div className="text-xs sm:text-sm text-slate-600 break-words bg-slate-50/60 p-2.5 rounded-lg border border-slate-100 min-h-[2.5rem] mt-1.5">
                            {change.oldValue || <span className="text-slate-400 italic">None</span>}
                          </div>
                        </div>
                      </div>
                      <div className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="text-2xs uppercase tracking-wider font-bold text-emerald-600 mb-1 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> New Value
                          </div>
                          <div className="text-xs sm:text-sm text-slate-900 break-words bg-emerald-50/30 p-2.5 rounded-lg border border-emerald-100 min-h-[2.5rem] mt-1.5 font-medium">
                            {change.newValue || <span className="text-slate-400 italic">None</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">No changes recorded</p>
            )}
            {selectedEntry.reason && (
              <div className="mt-4 bg-amber-50/50 border border-amber-200/60 rounded-xl p-3.5 sm:p-4">
                <div className="text-2xs uppercase tracking-wider font-bold text-amber-800 mb-1.5 flex items-center gap-1.5">
                  Reason for Change
                </div>
                <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">{selectedEntry.reason}</div>
              </div>
            )}
          </>
        )}
      </FormModal>
    </div>
  );
};
