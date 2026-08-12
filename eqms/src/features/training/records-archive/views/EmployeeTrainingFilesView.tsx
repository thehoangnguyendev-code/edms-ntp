import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Users,
  Download,
  ChevronUp,
  ChevronDown,
  X,
  History,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Zap,
  ShieldCheck,
  MoreVertical,
  Check,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { employeeTrainingFiles } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { Badge, Progress } from "@/components/ui";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import {
  useNavigateWithLoading,
  useTableFilter,
  useTableDragScroll,
  usePortalDropdown,
} from "@/hooks";
import { ROUTES } from "@/app/routes.constants";
import { MOCK_EMPLOYEE_TRAINING_FILES, MOCK_PENDING_SIGNATURES } from "../mockData";
import { PendingSignaturesModal } from "../components/PendingSignaturesModal";
import { LearningHistoryDrawer } from "../components/LearningHistoryDrawer";
import { EmployeeDropdownMenu } from "../components/EmployeeDropdownMenu";
import type { EmployeeTrainingFile, EmployeeFilters, PendingSignatureRecord, CompletedCourseRecord } from "@/features/training/types";
import { motion, AnimatePresence } from "framer-motion";
import { IconFilter2 } from "@tabler/icons-react";

export const EmployeeTrainingFilesView: React.FC = () => {
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const {
    openId: openDropdownId,
    position: dropdownPosition,
    getRef,
    toggle: handleDropdownToggle,
    close: closeDropdown
  } = usePortalDropdown();

  // Filters State
  const [filters, setFilters] = useState<Omit<EmployeeFilters, "searchQuery">>({
    departmentFilter: "All",
    businessUnitFilter: "All",
    positionFilter: "All",
    employeeTypeFilter: "All",
    complianceStatus: "All",
  });
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["department", "compliance"]));

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "employeeId",
    direction: "asc",
  });
  // Pending Signatures state
  const [pendingSignatures, setPendingSignatures] = useState<Record<string, PendingSignatureRecord[]>>(MOCK_PENDING_SIGNATURES);
  const [pendingSigEmployee, setPendingSigEmployee] = useState<EmployeeTrainingFile | null>(null);

  const [historyEmployee, setHistoryEmployee] = useState<EmployeeTrainingFile | null>(null);

  // Filter hook
  const {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginatedItems: paginatedData,
    filteredItems: filteredData,
  } = useTableFilter(MOCK_EMPLOYEE_TRAINING_FILES, {
    filterFn: (employee, q) => {
      const query = q.toLowerCase();
      const matchesSearch =
        !query ||
        employee.employeeName.toLowerCase().includes(query) ||
        employee.employeeId.toLowerCase().includes(query);
      const matchesDepartment = filters.departmentFilter === "All" || employee.department === filters.departmentFilter;
      const matchesBusinessUnit = filters.businessUnitFilter === "All" || employee.businessUnit === filters.businessUnitFilter;
      const matchesPosition = filters.positionFilter === "All" || employee.jobPosition === filters.positionFilter;
      const matchesEmployeeType = filters.employeeTypeFilter === "All" || employee.employeeType === filters.employeeTypeFilter;

      let matchesCompliance = true;
      if (filters.complianceStatus === "Fully Compliant") {
        matchesCompliance = employee.coursesCompleted === employee.totalCoursesRequired && employee.coursesObsolete === 0;
      } else if (filters.complianceStatus === "Has Gaps") {
        matchesCompliance = employee.coursesCompleted < employee.totalCoursesRequired;
      } else if (filters.complianceStatus === "Has Obsolete Records") {
        matchesCompliance = employee.coursesObsolete > 0;
      }

      return matchesSearch && matchesDepartment && matchesBusinessUnit && matchesPosition && matchesEmployeeType && matchesCompliance;
    }
  });

  // Sorting logic
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const key = sortConfig.key as keyof EmployeeTrainingFile;
      let aValue: any = a[key] ?? "";
      let bValue: any = b[key] ?? "";

      if (typeof aValue === "string") aValue = aValue.toLowerCase();
      if (typeof bValue === "string") bValue = bValue.toLowerCase();

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSortedData = useMemo(() => {
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, startIndex, itemsPerPage]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  // Remove a signed record and update compliance data
  const handleSignedRecord = (employeeId: string, recordId: string) => {
    setPendingSignatures((prev) => ({
      ...prev,
      [employeeId]: (prev[employeeId] ?? []).filter((r) => r.id !== recordId),
    }));
  };

  // Effective completion rate excludes courses with pending signatures
  const getEffectiveCompletionRate = (emp: EmployeeTrainingFile): number => {
    const pendingCount = (pendingSignatures[emp.id] ?? []).length;
    const effective = Math.max(0, emp.coursesCompleted - pendingCount);
    return Math.round((effective / emp.totalCoursesRequired) * 100);
  };

  // Sync loading state
  useEffect(() => {
    setIsTableLoading(true);
    const timer = setTimeout(() => setIsTableLoading(false), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, filters]);

  // Options
  const departmentOptions = [
    { label: "All Departments", value: "All" },
    { label: "Quality Assurance", value: "Quality Assurance" },
    { label: "Quality Control", value: "Quality Control" },
    { label: "Production", value: "Production" },
    { label: "Documentation", value: "Documentation" },
    { label: "Engineering", value: "Engineering" },
  ];

  const businessUnitOptions = [
    { label: "All Units", value: "All" },
    { label: "BU - Pharmaceutical", value: "BU - Pharmaceutical" },
    { label: "BU - Medical Device", value: "BU - Medical Device" },
    { label: "BU - Logistics", value: "BU - Logistics" },
  ];

  const positionOptions = [
    { label: "All Positions", value: "All" },
    { label: "QA Manager", value: "QA Manager" },
    { label: "QC Analyst", value: "QC Analyst" },
    { label: "Production Operator", value: "Production Operator" },
    { label: "Document Controller", value: "Document Controller" },
    { label: "Validation Engineer", value: "Validation Engineer" },
  ];

  const complianceStatusOptions = [
    { label: "All Statuses", value: "All" },
    { label: "Fully Compliant", value: "Fully Compliant" },
    { label: "Has Gaps", value: "Has Gaps" },
    { label: "Has Obsolete Records", value: "Has Obsolete Records" },
  ];

  const employeeTypeOptions = [
    { label: "All Types", value: "All" },
    { label: "Internal (FTE)", value: "Internal" },
    { label: "Contractor (EXT)", value: "Contractor" },
  ];

  const clearFilters = () => {
    setFilters({
      departmentFilter: "All",
      businessUnitFilter: "All",
      positionFilter: "All",
      employeeTypeFilter: "All",
      complianceStatus: "All",
    });
    setSearchQuery("");
    setCurrentPage(1);
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getOptionClassName = (isActive: boolean) =>
    cn(
      "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
      isActive
        ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
        : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-200"
    );

  const getCompletionColor = (rate: number, isObsolete: boolean): string => {
    if (isObsolete) return "text-orange-600";
    if (rate >= 95) return "text-emerald-600";
    if (rate >= 80) return "text-blue-600";
    if (rate >= 60) return "text-amber-600";
    return "text-red-600";
  };

  // Metrics Logic
  const stats = useMemo(() => {
    const total = MOCK_EMPLOYEE_TRAINING_FILES.length;
    const auditReady = MOCK_EMPLOYEE_TRAINING_FILES.filter(e => e.coursesCompleted === e.totalCoursesRequired && e.coursesObsolete === 0).length;
    const trainingGaps = MOCK_EMPLOYEE_TRAINING_FILES.reduce((sum, e) => sum + (e.totalCoursesRequired - e.coursesCompleted), 0);
    const obsoleteRecords = MOCK_EMPLOYEE_TRAINING_FILES.reduce((sum, e) => sum + e.coursesObsolete, 0);
    const newHiresCount = MOCK_EMPLOYEE_TRAINING_FILES.filter(e => e.isNewHire).length;

    return { total, auditReady, trainingGaps, obsoleteRecords, newHiresCount };
  }, []);

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Employee Training Files"
        breadcrumbItems={employeeTrainingFiles(navigateTo)}
        actions={
          <Button
            onClick={() => console.log("Export all records")}
            variant="outline"
            size="sm"
            className="whitespace-nowrap gap-2"
          >
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        {/* Total Employees */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100/50">
              <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 truncate">Total Employees</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 leading-none">{stats.total}</p>
            </div>
          </div>
        </div>

        {/* Audit Ready */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100/50">
              <ShieldCheck className="h-5 w-5 md:h-6 md:w-6 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 truncate">Audit Ready</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 leading-none">{stats.auditReady}</p>
            </div>
          </div>
        </div>

        {/* Training Gaps */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-red-50 flex items-center justify-center border border-red-100/50">
              <Zap className="h-5 w-5 md:h-6 md:w-6 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 truncate">Training Gaps</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 leading-none">{stats.trainingGaps}</p>
            </div>
          </div>
        </div>

        {/* Obsolete Records */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100/50">
              <History className="h-5 w-5 md:h-6 md:w-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 truncate">Obsolete Records</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 leading-none">{stats.obsoleteRecords}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Banner - Smart Notification (Matching TrainingMatrixView) */}
      <AnimatePresence>
        {stats.newHiresCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-2"
          >
            <WarningBanner
              variant="error"
              title="New Employee Missing Training"
              description={
                <p>
                  <span className="font-semibold text-red-700">David Brown</span> (Validation Engineer) was recently added to the system and has <span className="font-bold underline">7 missing</span> mandatory courses. Compliance at risk.
                </p>
              }
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 mt-3 sm:mt-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-700 hover:bg-red-100 text-xs h-8"
                  onClick={() => setFilters(prev => ({ ...prev, complianceStatus: 'Has Gaps' }))}
                >
                  Review Records
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white border-none text-xs h-8 gap-2"
                >
                  Assign Training Now <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </WarningBanner>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 w-full overflow-hidden flex flex-col">
        {/* Filter Section */}
        <div className="px-4 pt-4 md:p-5">
          <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Employee name or ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
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

          <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Employee name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-10 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400 bg-white"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Department</label>
              <Select
                value={filters.departmentFilter}
                onChange={(val) => setFilters(p => ({ ...p, departmentFilter: val }))}
                options={departmentOptions}
              />
            </div>
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Business Unit</label>
              <Select
                value={filters.businessUnitFilter}
                onChange={(val) => setFilters(p => ({ ...p, businessUnitFilter: val }))}
                options={businessUnitOptions}
              />
            </div>
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Compliance Status</label>
              <Select
                value={filters.complianceStatus}
                onChange={(val) => setFilters(p => ({ ...p, complianceStatus: val as any }))}
                options={complianceStatusOptions}
              />
            </div>
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Position</label>
              <Select
                value={filters.positionFilter}
                onChange={(val) => setFilters(p => ({ ...p, positionFilter: val }))}
                options={positionOptions}
              />
            </div>
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Employee Type</label>
              <Select
                value={filters.employeeTypeFilter}
                onChange={(val) => setFilters(p => ({ ...p, employeeTypeFilter: val }))}
                options={employeeTypeOptions}
              />
            </div>

            <div className="flex items-end">
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

        {/* Table Body */}
        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300">
            <div ref={scrollerRef} className={cn("flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400", isDragging ? "cursor-grabbing select-none" : "cursor-grab")} {...dragEvents}>
              <table className="w-full  border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-16">No.</th>
                    {[
                      { label: "Employee ID", id: "employeeId" },
                      { label: "Employee Name", id: "employeeName" },
                      { label: "Type", id: "employeeType" },
                      { label: "Business Unit", id: "businessUnit" },
                      { label: "Department", id: "department" },
                      { label: "Qualification", id: "qualificationStatus" },
                      { label: "Compliance", id: "coursesCompleted" },
                      { label: "Avg. Score", id: "averageScore", align: "text-center" },
                      { label: "Next Deadline", id: "nextDeadline" },
                    ].map((col, idx) => {
                      const isSorted = sortConfig.key === col.id;
                      return (
                        <th
                          key={idx}
                          onClick={() => handleSort(col.id)}
                          className={cn(
                            "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors group",
                            col.align || "text-left"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="truncate">{col.label}</span>
                            <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                              <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === 'asc' ? "text-emerald-600" : "")} />
                              <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === 'desc' ? "text-emerald-600" : "")} />
                            </div>
                          </div>
                        </th>
                      );
                    })}
                    <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedSortedData.length > 0 ? (
                    paginatedSortedData.map((emp, index) => {
                      const tdClass = "py-3 px-4 text-xs md:text-sm text-slate-500 font-medium border-b border-slate-200 whitespace-nowrap";
                      const completionRate = getEffectiveCompletionRate(emp);
                      const isObsolete = emp.coursesObsolete > 0;
                      const hasGaps = emp.coursesCompleted < emp.totalCoursesRequired;

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className={cn(tdClass, "text-center")}>{startIndex + index + 1}</td>
                          <td className={cn(tdClass, "font-medium text-emerald-600 hover:underline transition-colors cursor-pointer")}>
                            <button onClick={() => navigateTo(ROUTES.TRAINING.EMPLOYEE_DOSSIER(emp.id))}>{emp.employeeId}</button>
                          </td>
                          <td className={cn(tdClass)}>
                            <div className="flex flex-col">
                              <span className="text-xs md:text-sm font-medium text-slate-900 whitespace-nowrap">{emp.employeeName}</span>
                              <span className="text-2xs md:text-xs text-slate-500 mt-0.5 whitespace-nowrap">{emp.jobPosition}</span>
                            </div>
                          </td>
                          <td className={tdClass}>
                            <Badge
                              color={emp.employeeType === 'Internal' ? 'blue' : 'slate'}
                              size="sm"
                            >
                              {emp.employeeType === 'Internal' ? 'FTE' : 'EXT'}
                            </Badge>
                          </td>
                          <td className={tdClass}>{emp.businessUnit}</td>
                          <td className={tdClass}>{emp.department}</td>
                          <td className={tdClass}>
                            <Badge
                              color={
                                emp.qualificationStatus === 'Qualified' ? 'emerald' :
                                  emp.qualificationStatus === 'At Risk' ? 'red' :
                                    'blue'
                              }
                              size="sm"
                              showDot
                            >
                              {emp.qualificationStatus}
                            </Badge>
                          </td>
                          <td className={cn(tdClass, "min-w-[160px]")}>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 max-w-[70px]">
                                <Progress
                                  value={completionRate}
                                  size="xs"
                                  variant={
                                    isObsolete ? "warning" :
                                    completionRate >= 95 ? "success" :
                                    completionRate >= 80 ? "info" :
                                    "error"
                                  }
                                />
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={cn("font-bold text-2xs md:text-xs truncate", getCompletionColor(completionRate, isObsolete))}>
                                  {completionRate}%
                                </span>
                                {isObsolete && (
                                  <motion.div
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    className="shrink-0"
                                  >
                                    <Badge color="red" size="sm">
                                      {emp.coursesObsolete} Obsolete
                                    </Badge>
                                  </motion.div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={cn(tdClass, "text-center text-xs md:text-sm font-semibold text-slate-900")}>{emp.averageScore === 0 ? "-" : `${emp.averageScore}%`}</td>
                          <td className={tdClass}>
                            <div className="flex flex-col">
                              <span className={cn(
                                "font-bold",
                                (hasGaps || isObsolete) ? "text-red-600" : "text-slate-500"
                              )}>
                                {emp.nextDeadline || "-"}
                              </span>
                              {(hasGaps || isObsolete) && (
                                <span className="text-2xs font-medium uppercase tracking-tighter opacity-70">
                                  {isObsolete ? "Retraining Due" : "Initial Gap"}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="sticky right-0 z-10 bg-white border-b border-slate-200 py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 group-hover:bg-slate-50 transition-colors">
                            <button
                              ref={getRef(emp.id)}
                              onClick={(e) => handleDropdownToggle(emp.id, e)}
                              className="h-8 w-8 mx-auto rounded-lg hover:bg-slate-200 flex items-center justify-center transition-colors"
                            >
                              <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10}>
                        <TableEmptyState
                          title="No Training Records Found"
                          description="Try broadening your search or adjusting compliance filters."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={sortedData.length}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={(val) => {
                setItemsPerPage(val);
                setCurrentPage(1);
              }}
              showItemCount={true}
            />
          </div>
        </div>
      </div>

      {openDropdownId && (() => {
        const emp = paginatedData.find(e => e.id === openDropdownId);
        return emp ? (
          <EmployeeDropdownMenu
            employee={emp}
            isOpen={openDropdownId !== null}
            onClose={closeDropdown}
            position={dropdownPosition}
            onNavigate={navigateTo}
            onOpenPendingSignatures={(e) => { setPendingSigEmployee(e); closeDropdown(); }}
            onOpenHistory={(e) => { setHistoryEmployee(e); closeDropdown(); }}
            pendingSignaturesCount={(pendingSignatures[emp.id] ?? []).length}
          />
        ) : null;
      })()}


      <PendingSignaturesModal
        isOpen={!!pendingSigEmployee}
        onClose={() => setPendingSigEmployee(null)}
        employee={pendingSigEmployee}
        pendingRecords={pendingSigEmployee ? (pendingSignatures[pendingSigEmployee.id] ?? []) : []}
        onSigned={(recordId) => {
          if (pendingSigEmployee) handleSignedRecord(pendingSigEmployee.id, recordId);
        }}
      />

      <LearningHistoryDrawer
        isOpen={!!historyEmployee}
        onClose={() => setHistoryEmployee(null)}
        employee={historyEmployee}
      />

      {/* ─── Loading Overlays ─────────────────────────────────── */}
      {(isNavigating || initialLoading) && (
        <FullPageLoading text={initialLoading ? "Fetching Training Archive..." : "Loading..."} />
      )}

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
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
                  setFilters((prev) => ({ ...prev, departmentFilter: opt.value }));
                  setCurrentPage(1);
                }}
                className={getOptionClassName(filters.departmentFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {filters.departmentFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Business Unit"
          isExpanded={expandedSections.has("businessUnit")}
          onToggle={() => toggleSection("businessUnit")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {businessUnitOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setFilters((prev) => ({ ...prev, businessUnitFilter: opt.value }));
                  setCurrentPage(1);
                }}
                className={getOptionClassName(filters.businessUnitFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {filters.businessUnitFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Position"
          isExpanded={expandedSections.has("position")}
          onToggle={() => toggleSection("position")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {positionOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setFilters((prev) => ({ ...prev, positionFilter: opt.value }));
                  setCurrentPage(1);
                }}
                className={getOptionClassName(filters.positionFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {filters.positionFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Employee Type"
          isExpanded={expandedSections.has("employeeType")}
          onToggle={() => toggleSection("employeeType")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {employeeTypeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setFilters((prev) => ({ ...prev, employeeTypeFilter: opt.value }));
                  setCurrentPage(1);
                }}
                className={getOptionClassName(filters.employeeTypeFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {filters.employeeTypeFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Compliance Status"
          isExpanded={expandedSections.has("compliance")}
          onToggle={() => toggleSection("compliance")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {complianceStatusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setFilters((prev) => ({ ...prev, complianceStatus: opt.value as any }));
                  setCurrentPage(1);
                }}
                className={getOptionClassName(filters.complianceStatus === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {filters.complianceStatus === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
