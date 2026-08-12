import React, { useState, useMemo, useEffect } from "react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ROUTES } from "@/app/routes.constants";
import {
    Search,
    GraduationCap,
    Users,
    ShieldAlert,
    Download,
    MoreVertical,
    X,
    ChevronUp,
    ChevronDown,
    ChevronRight,
    XCircle,
} from "lucide-react";
import {IconInfoCircle, IconChecks, IconPlus, IconCheck, IconFilter2, IconPlaystationX, IconPencilMinus} from "@tabler/icons-react";
import { FullPageLoading, SectionLoading } from "@/components/ui/loading/Loading";
import { PageHeader } from "@/components/ui/page/PageHeader";
import {
  coursesList,
  coursePendingReview,
  coursePendingApproval
} from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { cn } from "@/components/ui/utils";
import { formatDate } from "@/utils/format";
import { StatusBadge, Badge } from "@/components/ui/badge/Badge";
import { getTrainingMethodConfig, mapStatusToStatusType } from "@/utils/status";
import { ExpandedCourseRow } from "../components/ExpandedCourseRow";
import {
  TrainingRecord,
  TrainingFilters,
  TrainingStatus,
  TrainingType,
  TrainingMethod,
  CourseApproval,
} from "../types";
import {
  MOCK_TRAININGS,
  MOCK_PENDING_REVIEWS,
  MOCK_PENDING_APPROVAL
} from "../mockData";
import { usePortalDropdown, useNavigateWithLoading, useTableFilter, useTableDragScroll, PortalDropdownPosition } from "@/hooks";
import { useTrainingPermissions } from "@/features/training/useTrainingPermissions";

// ── Types ─────────────────────────────────────────────────────────
type CourseInventoryMode = "list" | "review" | "approval";

// ── Local Dropdown ────────────────────────────────────────────────
interface CourseDropdownMenuProps {
  training: TrainingRecord | CourseApproval;
  isOpen: boolean;
  onClose: () => void;
  position: PortalDropdownPosition;
  onNavigate: (path: string, options?: any) => void;
  mode: CourseInventoryMode;
  canEditCourses: boolean;
  canReviewCourses: boolean;
  canApproveCourses: boolean;
  canObsoleteCourses: boolean;
}

const CourseDropdownMenu: React.FC<CourseDropdownMenuProps> = ({
  training,
  isOpen,
  onClose,
  position,
  onNavigate,
  mode,
  canEditCourses,
  canReviewCourses,
  canApproveCourses,
  canObsoleteCourses,
}) => {
  if (!isOpen) return null;

  const id = training.id;

  // Normalize status for dropdown logic
  const status = 'status' in training ? training.status : (training as CourseApproval).approvalStatus;

  type MenuItem =
    | { isDivider: true }
    | { isDivider?: false; icon: React.ElementType; label: string; onClick: () => void; color?: string };

  const menuItems: MenuItem[] = [
    {
      icon: IconInfoCircle,
      label: "View Detail",
      onClick: () => {
        const detailRoute = mode === 'list'
          ? ROUTES.TRAINING.COURSE_DETAIL(id)
          : mode === 'review'
            ? ROUTES.TRAINING.APPROVAL_DETAIL(id)
            : ROUTES.TRAINING.APPROVE_DETAIL(id);

        const fromTab = mode === 'review' ? 'pending-review' : mode === 'approval' ? 'pending-approval' : 'inventory';

        onNavigate(detailRoute, { state: { from: `?tab=${fromTab}` } });
        onClose();
      },
      color: "text-slate-500"
    },
  ];

  if (mode === 'list') {
    if (canEditCourses) {
      menuItems.push({
      icon: IconPencilMinus,
      label: "Edit Course",
      onClick: () => {
        onNavigate(ROUTES.TRAINING.COURSE_EDIT(id), { state: { from: "?tab=inventory" } });
        onClose();
      },
      color: "text-slate-500"
      });
    }

    if (status === "Effective" && canObsoleteCourses) {
      menuItems.push({
        icon: XCircle ,
        label: "Mark as Obsolete",
        onClick: () => {
          onNavigate(ROUTES.TRAINING.COURSE_IMPACT_ASSESSMENT(id), { state: { from: "?tab=inventory" } });
          onClose();
        },
        color: "text-slate-500"
      });
    }

    if (status === "Pending Review" && canReviewCourses) {
      menuItems.push({
        icon: IconCheck,
        label: "Review Course",
        onClick: () => {
          onNavigate(ROUTES.TRAINING.APPROVAL_DETAIL(id), { state: { from: "?tab=pending-review" } });
          onClose();
        },
        color: "text-slate-500"
      });
    }

    if (status === "Pending Approval" && canApproveCourses) {
      menuItems.push({
        icon: IconChecks,
        label: "Approve Course",
        onClick: () => {
          onNavigate(ROUTES.TRAINING.APPROVE_DETAIL(id), { state: { from: "?tab=pending-approval" } });
          onClose();
        },
        color: "text-slate-500"
      });
    }
  } else if (mode === 'review' && canReviewCourses) {
    menuItems.push({
      icon: IconCheck,
      label: "Review Course",
      onClick: () => {
        onNavigate(ROUTES.TRAINING.APPROVAL_DETAIL(id), { state: { from: ROUTES.TRAINING.PENDING_REVIEW } });
        onClose();
      },
      color: "text-slate-500"
    });
  } else if (mode === 'approval' && canApproveCourses) {
    menuItems.push({
      icon: IconChecks,
      label: "Approve Course",
      onClick: () => {
        onNavigate(ROUTES.TRAINING.APPROVE_DETAIL(id), { state: { from: ROUTES.TRAINING.PENDING_APPROVAL } });
        onClose();
      },
      color: "text-slate-500"
    });
  }
  menuItems.push({
    icon: Download,
    label: "Export PDF",
    onClick: () => {
      console.log("Export PDF:", id);
      onClose();
    },
    color: "text-slate-500"
  });

  return (
    <PortalDropdownMenu isOpen={isOpen} onClose={onClose} position={position} minWidth={180}>
      <div className="py-1">
        {menuItems.map((item, i) => {
          if ("isDivider" in item && item.isDivider) {
            return <div key={i} className="my-1 border-t border-slate-100" />;
          }
          const mi = item as Exclude<MenuItem, { isDivider: true }>;
          const Icon = mi.icon;
          return (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                mi.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 active:bg-slate-100 transition-colors",
                mi.color
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">{mi.label}</span>
            </button>
          );
        })}
      </div>
    </PortalDropdownMenu>
  );
};

// ── Main Component ───────────────────────────────────────────────
const CourseInventoryView: React.FC<{ mode: CourseInventoryMode }> = ({ mode }) => {
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const {
    canCreateCourses,
    canEditCourses,
    canReviewCourses,
    canApproveCourses,
    canObsoleteCourses,
  } = useTrainingPermissions();
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = useMemo(() => shouldReduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 16 }, [shouldReduceMotion]);

  // Mode-specific configuration
  const config = useMemo(() => {
    switch (mode) {
      case "review":
        return {
          title: "Pending Review",
          breadcrumb: coursePendingReview(navigateTo),
          dataSource: MOCK_PENDING_REVIEWS,
          emptyTitle: "No reviews found",
          emptyDescription: "No course approvals match your current filters."
        };
      case "approval":
        return {
          title: "Pending Approval",
          breadcrumb: coursePendingApproval(navigateTo),
          dataSource: MOCK_PENDING_APPROVAL,
          emptyTitle: "No approvals found",
          emptyDescription: "All courses have been approved or no courses match your filters."
        };
      default:
        return {
          title: "Courses List",
          breadcrumb: coursesList(navigateTo),
          dataSource: MOCK_TRAININGS,
          emptyTitle: "No Training Records Found",
          emptyDescription: "We couldn’t find any training records matching your filters."
        };
    }
  }, [mode, navigateTo]);

  // Filters
  const [filters, setFilters] = useState<Omit<TrainingFilters, "searchQuery">>({
    typeFilter: "All",
    statusFilter: "All",
    dateFrom: "",
    dateTo: "",
  });
  const [methodFilter, setMethodFilter] = useState<TrainingMethod | "All">("All");
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "trainingId",
    direction: "asc",
  });
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status", "type"]));

  const rawData = useMemo(() => {
    if (mode === 'list') {
      const obsoleted = JSON.parse(localStorage.getItem("obsoleted_courses") || "[]");
      return (config.dataSource as TrainingRecord[]).map(t => {
        if (obsoleted.includes(t.trainingId) || obsoleted.includes(t.id)) {
          return { ...t, status: "Obsoleted" as any };
        }
        return t;
      });
    }
    return config.dataSource;
  }, [config.dataSource, mode]);

  // Use shared Table Filter hook
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
  } = useTableFilter(rawData as any[], {
    filterFn: (item: any, q) => {
      const query = q.toLowerCase();

      const courseName = item.courseName || item.title || "";
      const trainingId = item.trainingId || "";
      const instructor = item.instructor || "";
      const type = item.type || item.trainingType || "";
      const status = item.status || item.approvalStatus || "";
      const method = item.trainingMethod || "";
      const scheduledDate = item.scheduledDate || item.submittedAt || "";

      const matchesSearch =
        !query ||
        courseName.toLowerCase().includes(query) ||
        trainingId.toLowerCase().includes(query) ||
        instructor.toLowerCase().includes(query);

      const matchesType = filters.typeFilter === "All" || type === filters.typeFilter;
      const matchesStatus = filters.statusFilter === "All" || status === filters.statusFilter;
      const matchesMethod = methodFilter === "All" || method === methodFilter;

      let matchesDateFrom = true;
      let matchesDateTo = true;

      if (filters.dateFrom && scheduledDate) {
        matchesDateFrom = new Date(scheduledDate) >= new Date(filters.dateFrom);
      }
      if (filters.dateTo && scheduledDate) {
        matchesDateTo = new Date(scheduledDate) <= new Date(filters.dateTo);
      }

      return matchesSearch && matchesType && matchesStatus && matchesMethod && matchesDateFrom && matchesDateTo;
    }
  });

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const key = sortConfig.key;
      let aValue: any = a[key];
      let bValue: any = b[key];

      // Handle specific mappings for different modes
      if (key === 'courseName' && !aValue) aValue = a.title;
      if (key === 'courseName' && !bValue) bValue = b.title;
      if (key === 'type' && !aValue) aValue = a.trainingType;
      if (key === 'type' && !bValue) bValue = b.trainingType;
      if (key === 'status' && !aValue) aValue = a.approvalStatus;
      if (key === 'status' && !bValue) bValue = b.approvalStatus;

      if (key === "scheduledDate") {
        const parseD = (s: string) => {
          if (!s) return 0;
          const parts = s.split("/");
          return parts.length === 3 ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime() : new Date(s).getTime();
        };
        aValue = parseD(aValue || a.submittedAt);
        bValue = parseD(bValue || b.submittedAt);
      }

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

  const { openId: openDropdownId, position: dropdownPosition, getRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  // --- Effects ---

  // Set initial status based on mode and handle auto-pagination reset
  useEffect(() => {
    if (mode === "review") {
      setFilters(prev => ({ ...prev, statusFilter: "Pending Review" }));
    } else if (mode === "approval") {
      setFilters(prev => ({ ...prev, statusFilter: "Pending Approval" }));
    } else {
      setFilters(prev => ({ ...prev, statusFilter: "All" }));
    }
    setCurrentPage(1);
    setSearchQuery("");
  }, [mode, setCurrentPage, setSearchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.typeFilter, filters.statusFilter, filters.dateFrom, filters.dateTo, methodFilter, setCurrentPage]);

  // Handle loading state on filter changes
  useEffect(() => {
    setIsTableLoading(true);
    const timer = setTimeout(() => setIsTableLoading(false), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, filters, methodFilter, mode]);

  // Filter Options
  const typeOptions = [
    { label: "All Types", value: "All" },
    { label: "GMP", value: "GMP" },
    { label: "Technical", value: "Technical" },
    { label: "Compliance", value: "Compliance" },
    { label: "SOP", value: "SOP" },
    { label: "Safety", value: "Safety" },
  ];

  const methodOptions = [
    { label: "All Methods", value: "All" },
    { label: "Read & Understood", value: "Read & Understood" },
    { label: "Quiz (Paper-based/Manual)", value: "Quiz (Paper-based/Manual)" },
    { label: "Hands-on / OJT", value: "Hands-on/OJT" },
  ];

  const statusOptions = [
    { label: "All Status", value: "All" },
    { label: "Draft", value: "Draft" },
    { label: "Pending Review", value: "Pending Review" },
    { label: "Pending Approval", value: "Pending Approval" },
    { label: "Effective", value: "Effective" },
    { label: "Obsoleted", value: "Obsoleted" },
  ];

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

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title={config.title}
        breadcrumbItems={config.breadcrumb}
        actions={
          <>
            <Button
              onClick={() => console.log("Export triggered")}
              variant="outline"
              size="sm"
              className="whitespace-nowrap gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            {mode === 'list' && canCreateCourses && (
              <Button
                onClick={() => navigateTo(ROUTES.TRAINING.COURSES_CREATE)}
                size="sm"
                className="whitespace-nowrap gap-2"
              >
                <IconPlus className="h-4 w-4" />
                New Course
              </Button>
            )}
          </>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 w-full overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 flex-1 flex flex-col overflow-hidden">
          <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
            {/* Mobile Filter UI */}
            <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
              <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
              <div className="flex items-center gap-2 w-full">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
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

            {/* Desktop Filter UI */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end mb-5">
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium text-slate-700 block transition-colors px-0.5 mb-1.5">
                  Search
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
                    <Search className="h-4 w-4 text-slate-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by title, ID, or instructor..."
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

              <Select
                label="Training Type"
                value={filters.typeFilter}
                onChange={(val) =>
                  setFilters((prev) => ({ ...prev, typeFilter: val as TrainingType | "All" }))
                }
                options={typeOptions}
              />

              <Select
                label="Training Method"
                value={methodFilter}
                onChange={(val) => setMethodFilter(val as TrainingMethod | "All")}
                options={methodOptions}
              />

              <Select
                label="Status"
                value={filters.statusFilter}
                onChange={(val) =>
                  setFilters((prev) => ({ ...prev, statusFilter: val as TrainingStatus | "All" }))
                }
                options={statusOptions}
                disabled={mode !== "list"}
              />

              <div className="lg:col-span-1">
                <DateRangePicker
                  label={mode === 'list' ? "Scheduled Date Range" : "Submitted Date Range"}
                  startDate={filters.dateFrom}
                  endDate={filters.dateTo}
                  onStartDateChange={(val) =>
                    setFilters((prev) => ({ ...prev, dateFrom: val }))
                  }
                  onEndDateChange={(val) =>
                    setFilters((prev) => ({ ...prev, dateTo: val }))
                  }
                  placeholder="Select date range"
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilters({
                      typeFilter: "All",
                      statusFilter: mode === "review" ? "Pending Review" : mode === "approval" ? "Pending Approval" : "All",
                      dateFrom: "",
                      dateTo: "",
                    });
                    setMethodFilter("All");
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="flex-1 flex flex-col relative">
            {isTableLoading && (
              <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300 rounded-xl">
                <SectionLoading text="Searching..." minHeight="150px" />
              </div>
            )}

            <div className={cn(
              "border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300",
              isTableLoading && "blur-[2px] opacity-80"
            )}>
              <div
                ref={scrollerRef}
                className={cn(
                  "flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400 transition-colors",
                  isDragging ? "cursor-grabbing select-none" : "cursor-grab"
                )}
                {...dragEvents}
              >
                <table className="w-full min-w-[800px] md:min-w-[980px] lg:min-w-[1160px] xl:min-w-[1320px] border-spacing-0 text-left">
                  <thead>
                    <tr>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-9"></th>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-16">
                        No.
                      </th>
                      {[
                        { label: "Course ID", id: "trainingId" },
                        { label: "Course Name", id: "courseName" },
                        { label: "Type", id: "type" },
                        { label: "Method", id: "trainingMethod" },
                        { label: "Status", id: "status" },
                        { label: "Instructor", id: "instructor" },
                        { label: "Retraining", id: "recurrence" },
                        { label: "Scheduled", id: "scheduledDate" },
                        { label: "Enrolled", id: "enrolled", align: "text-center" }
                        , { label: "Created", id: "createdAt" }
                      ].map((col, idx) => {
                        const isSorted = sortConfig.key === col.id;
                        return (
                          <th
                            key={idx}
                            onClick={() => handleSort(col.id)}
                            className={cn(
                              "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors group",
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
                      <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedSortedData.length > 0 ? (
                      paginatedSortedData.map((item, index) => {
                        const tdClass = "py-3 px-4 text-xs md:text-sm text-slate-700 border-b border-slate-200 whitespace-nowrap";

                        const courseName = item.courseName || item.title;
                        const description = item.description || item.relatedDocument;
                        const type = item.type || item.trainingType;
                        const status = item.status || item.approvalStatus;
                        const scheduledDate = item.scheduledDate || item.submittedAt;

                        const isExpanded = expandedRowId === item.id;
                        const hasMaterials = (item.trainingFiles && item.trainingFiles.length > 0) || (item.materials && item.materials.length > 0) || item.linkedDocumentId;

                        return (
                          <React.Fragment key={item.id}>
                            <tr
                              className="hover:bg-slate-50/80 transition-colors group"
                            >
                              <td className="py-3 px-4 border-b border-slate-200 whitespace-nowrap" onClick={(e) => {
                                e.stopPropagation();
                                if (hasMaterials) setExpandedRowId(isExpanded ? null : item.id);
                              }}>
                                {hasMaterials && (
                                  <button className="flex items-center justify-center h-5 w-5 md:h-6 md:w-6 rounded-lg hover:bg-slate-200 transition-colors">
                                    <motion.span
                                      animate={{ rotate: isExpanded ? 90 : 0 }}
                                      transition={transitionConfig}
                                      className="inline-flex items-center justify-center"
                                    >
                                      <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500" />
                                    </motion.span>
                                  </button>
                                )}
                              </td>
                              <td className={cn(tdClass, "text-center text-slate-500 font-medium")}>
                                {startIndex + index + 1}
                              </td>
                              <td
                                className={cn(tdClass, "cursor-pointer")}
                                onClick={() => {
                                  const detailRoute = mode === 'list'
                                    ? ROUTES.TRAINING.COURSE_DETAIL(item.id)
                                    : mode === 'review'
                                      ? ROUTES.TRAINING.APPROVAL_DETAIL(item.id)
                                      : ROUTES.TRAINING.APPROVE_DETAIL(item.id);

                                  const fromTab = mode === 'review' ? 'pending-review' : mode === 'approval' ? 'pending-approval' : (status === "Pending Review" ? "pending-review" : status === "Pending Approval" ? "pending-approval" : "inventory");

                                  navigateTo(detailRoute, { state: { from: `?tab=${fromTab}` } });
                                }}
                              >
                                <span className="font-medium text-emerald-600 hover:underline">
                                  {item.trainingId}
                                </span>
                              </td>
                              <td className={tdClass}>
                                <div className="flex items-start gap-2">
                                  <GraduationCap className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                                  <div className="max-w-[200px] md:max-w-md">
                                    <p className="font-medium text-slate-900">
                                      {courseName}
                                    </p>
                                    <p className="text-2xs md:text-xs text-slate-500 mt-0.5">
                                      {description}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className={tdClass}>
                                {type && (
                                  <Badge color="blue" size="sm" className="font-medium">
                                    {type}
                                  </Badge>
                                )}
                              </td>
                              <td className={tdClass}>
                                {item.trainingMethod && (() => {
                                  const cfg = getTrainingMethodConfig(item.trainingMethod);
                                  return (
                                    <Badge
                                      color={cfg.className.includes('purple') ? 'purple' : cfg.className.includes('amber') ? 'amber' : 'slate'}
                                      size="sm"
                                      className="font-medium"
                                    >
                                      {cfg.label}
                                    </Badge>
                                  );
                                })()}
                              </td>
                              <td className={tdClass}>
                                <StatusBadge
                                  status={mapStatusToStatusType(status) as any}
                                  size="sm"
                                />
                              </td>
                              <td className={tdClass}>
                                {item.instructor || "—"}
                              </td>
                              <td className={tdClass}>
                                {item.recurrence?.enabled ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                                      <IconChecks className="h-4 w-4" />
                                      Every {item.recurrence.intervalMonths}m
                                    </span>
                                    <span className="text-xs text-slate-400 font-normal ml-5">
                                      (WP: {item.recurrence.warningPeriodDays}d)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500 text-xs sm:text-sm">Disabled</span>
                                )}
                              </td>
                              <td className={tdClass}>
                                {formatDate(scheduledDate)}
                              </td>
                              <td className={tdClass}>
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-slate-400" />
                                  <span className="text-slate-900 font-medium">
                                    {item.enrolled ?? 0}/{item.capacity ?? 0}
                                  </span>
                                </div>
                              </td>
                              <td className={tdClass}>
                                {item.createdAt || "—"}
                              </td>
                              <td
                                onClick={(e) => e.stopPropagation()}
                                className="sticky right-0 z-10 bg-white border-b border-slate-200 py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors"
                              >
                                <button
                                  ref={getRef(item.id)}
                                  onClick={(e) => handleDropdownToggle(item.id, e)}
                                  className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 transition-colors"
                                  aria-label="More actions"
                                >
                                  <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-600" />
                                </button>
                                <CourseDropdownMenu
                                  training={item}
                                  isOpen={openDropdownId === item.id}
                                  onClose={closeDropdown}
                                  position={dropdownPosition}
                                  onNavigate={navigateTo}
                                  mode={mode}
                                  canEditCourses={canEditCourses}
                                  canReviewCourses={canReviewCourses}
                                  canApproveCourses={canApproveCourses}
                                  canObsoleteCourses={canObsoleteCourses}
                                />
                              </td>
                            </tr>
                            <ExpandedCourseRow
                              item={item}
                              isExpanded={isExpanded}
                              visibleColumnsLength={13}
                            />
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={13}>
                          <TableEmptyState
                            title={config.emptyTitle}
                            description={config.emptyDescription}
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
                onItemsPerPageChange={setItemsPerPage}
                showItemCount={true}
              />
            </div>
          </div>
        </div>

        {isNavigating && <FullPageLoading text="Loading..." />}

        {/* Mobile Filter Drawer */}
        <FilterDrawer
          isOpen={isFilterDrawerOpen}
          onClose={() => setIsFilterDrawerOpen(false)}
          onClear={() => {
            setFilters({
              typeFilter: "All",
              statusFilter: mode === "review" ? "Pending Review" : mode === "approval" ? "Pending Approval" : "All",
              dateFrom: "",
              dateTo: "",
            });
            setMethodFilter("All");
            setSearchQuery("");
            setCurrentPage(1);
          }}
          onApply={() => setIsFilterDrawerOpen(false)}
          title="Filter Courses"
        >
          {/* Training Type */}
          <FilterAccordionItem
            label="Training Type"
            isExpanded={expandedSections.has("type")}
            onToggle={() => toggleSection("type")}
          >
            <div className="grid grid-cols-1 gap-2.5 pt-1 pb-4">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilters((prev) => ({ ...prev, typeFilter: opt.value as TrainingType | "All" }))}
                  className={getOptionClassName(filters.typeFilter === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {filters.typeFilter === opt.value && <IconCheck size={16} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </FilterAccordionItem>

          {/* Training Method */}
          <FilterAccordionItem
            label="Training Method"
            isExpanded={expandedSections.has("method")}
            onToggle={() => toggleSection("method")}
          >
            <div className="grid grid-cols-1 gap-2.5 pt-1 pb-4">
              {methodOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMethodFilter(opt.value as TrainingMethod | "All")}
                  className={getOptionClassName(methodFilter === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {methodFilter === opt.value && <IconCheck size={16} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </FilterAccordionItem>

          {/* Status */}
          <FilterAccordionItem
            label="Status"
            isExpanded={expandedSections.has("status")}
            onToggle={() => toggleSection("status")}
            disabled={mode !== "list"}
          >
            <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
              {statusOptions.map((opt) => {
                const isRestricted = mode !== "list";
                const isSelected = filters.statusFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      if (isRestricted) return;
                      setFilters((prev) => ({ ...prev, statusFilter: opt.value as TrainingStatus | "All" }));
                    }}
                    className={cn(
                      getOptionClassName(isSelected),
                      isRestricted && (isSelected ? "opacity-100 cursor-default" : "opacity-40 grayscale pointer-events-none")
                    )}
                  >
                    <span className="text-xs">{opt.label}</span>
                    {isSelected && <IconCheck size={16} className="text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          </FilterAccordionItem>

          {/* Date Range */}
          <FilterAccordionItem
            label={mode === 'list' ? "Scheduled Date Range" : "Submitted Date Range"}
            isExpanded={expandedSections.has("date")}
            onToggle={() => toggleSection("date")}
          >
            <div className="pt-2 pb-4">
              <DateRangePicker
                startDate={filters.dateFrom}
                endDate={filters.dateTo}
                onStartDateChange={(val) => setFilters((prev) => ({ ...prev, dateFrom: val }))}
                onEndDateChange={(val) => setFilters((prev) => ({ ...prev, dateTo: val }))}
                placeholder="Select Date Range"
              />
            </div>
          </FilterAccordionItem>
        </FilterDrawer>
      </div>

      {isNavigating && <FullPageLoading text="Loading..." />}
    </div>
  );
};

// ── Exported Specialized Views ───────────────────────────────────
export const CourseListView: React.FC = () => <CourseInventoryView mode="list" />;
export const PendingReviewView: React.FC = () => <CourseInventoryView mode="review" />;
export const PendingApprovalView: React.FC = () => <CourseInventoryView mode="approval" />;
