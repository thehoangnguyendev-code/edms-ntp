import React, { useState, useMemo, useRef } from "react";
import { TrainingMethod } from "../../../types";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import {
  Search,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  BarChart3,
  ArrowLeft,
  Download,
  TrendingUp,
  Target,
  UserCheck,
  UserX,
  FileText,
  Paperclip,
  Mail,
  Bell,
  ExternalLink,
  Repeat,
  ShieldCheck,
  MoreVertical,
  X,
  ChevronUp,
  ChevronDown,
  Check,
} from "lucide-react";
import { usePortalDropdown, useNavigateWithLoading, useTableDragScroll, PortalDropdownPosition } from "@/hooks";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { courseProgress } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { ESignatureModal } from "@/components/ui/esign-modal";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { cn } from "@/components/ui/utils";
import { Progress } from "@/components/ui";
import { Badge } from "@/components/ui/badge/Badge";
import { formatDateUS } from "@/utils/format";
import { getStatusColorClass } from "@/utils/status";
import type { EnrollmentStatus, ResultStatus, EmployeeProgress, CourseProgressInfo } from "../../../types";
import { complianceTrackingRepository } from "../../repository";
import { IconFilter2 } from "@tabler/icons-react";

/* ------------------------------------------------------------------ */
/*  Local Dropdown Component                                           */
/* ------------------------------------------------------------------ */

interface EmployeeDropdownMenuProps {
  employee: EmployeeProgress;
  courseId: string;
  isOpen: boolean;
  onClose: () => void;
  position: PortalDropdownPosition;
  onNavigate: (path: string) => void;
}

const EmployeeDropdownMenu: React.FC<EmployeeDropdownMenuProps> = ({
  employee,
  courseId,
  isOpen,
  onClose,
  position,
  onNavigate,
}) => {
  if (!isOpen) return null;

  type MenuItem =
    | { isDivider: true }
    | { isDivider?: false; icon: React.ElementType; label: string; onClick: () => void; color?: string; disabled?: boolean };

  const menuItems: MenuItem[] = [];

  if (employee.enrollmentStatus === "In-Progress") {
    menuItems.push({
      icon: ExternalLink,
      label: "Enter Result",
      onClick: () => {
        onNavigate(ROUTES.TRAINING.COURSE_RESULT_ENTRY(courseId));
        onClose();
      },
      color: "text-slate-500",
    });
    menuItems.push({
      icon: Bell,
      label: "Send Reminder",
      onClick: () => {
        console.log("Reminder sent to", employee.email);
        onClose();
      },
      color: "text-slate-500",
    });
  }

  if (employee.resultStatus === "Fail") {
    menuItems.push({
      icon: Repeat,
      label: "Re-assign Training",
      onClick: () => {
        console.log("Re-assigned", employee.userId);
        onClose();
      },
      color: "text-slate-500",
    });
  }

  if (employee.enrollmentStatus === "Completed") {
    menuItems.push({
      icon: Paperclip,
      label: "View Evidence",
      onClick: () => {
        alert("Opening Evidence for " + employee.fullName);
        onClose();
      },
      color: "text-slate-500",
    });
  }

  if (menuItems.length === 0) {
    menuItems.push({
      label: "No Actions Available",
      icon: AlertCircle,
      onClick: () => onClose(),
      color: "text-slate-500",
      disabled: true
    });
  }

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
              disabled={mi.disabled}
              onClick={(e) => {
                e.stopPropagation();
                mi.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 active:bg-slate-100 transition-colors",
                mi.color,
                mi.disabled && "opacity-50 cursor-not-allowed"
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

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export const CourseProgressView: React.FC = () => {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { openId: openDropdownId, position: dropdownPosition, getRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const [isESignatureOpen, setIsESignatureOpen] = useState(false);

  const progressInfoData = complianceTrackingRepository.getCourseProgressInfo();
  const employeeProgressData = complianceTrackingRepository.getEmployeeProgressData();

  const info = {
    ...progressInfoData,
    dueDate: "2026-04-15",
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [enrollmentFilter, setEnrollmentFilter] = useState<EnrollmentStatus | "All">("All");
  const [resultFilter, setResultFilter] = useState<ResultStatus | "All">("All");
  const [departmentFilter, setDepartmentFilter] = useState<string>("All");
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string>("All");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["enrollment", "result"]));

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: "asc" | "desc" }>({
    key: "userId",
    direction: "asc",
  });

  // Sorting Handler
  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Derived data
  const uniqueDepartments = useMemo(
    () => Array.from(new Set(employeeProgressData.map((e) => e.department))).sort(),
    [employeeProgressData]
  );

  const uniqueBusinessUnits = useMemo(
    () => Array.from(new Set(employeeProgressData.map((e) => e.businessUnit))).sort(),
    [employeeProgressData]
  );

  const enrollmentOptions = [
    { label: "All Enrollments", value: "All" },
    { label: "Completed", value: "Completed" },
    { label: "In-Progress", value: "In-Progress" },
    { label: "Not Started", value: "Not Started" },
    { label: "Overdue", value: "Overdue" },
    { label: "Exempt", value: "Exempt" },
  ];

  const resultOptions = [
    { label: "All Results", value: "All" },
    { label: "Pass", value: "Pass" },
    { label: "Fail", value: "Fail" },
    { label: "Pending", value: "Pending" },
    { label: "N/A", value: "N/A" },
  ];

  const clearFilters = () => {
    setSearchQuery("");
    setEnrollmentFilter("All");
    setResultFilter("All");
    setDepartmentFilter("All");
    setBusinessUnitFilter("All");
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

  const filteredEmployees = useMemo(() => {
    let filtered = employeeProgressData;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.userId.toLowerCase().includes(q) ||
          e.fullName.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q) ||
          e.businessUnit.toLowerCase().includes(q)
      );
    }

    if (enrollmentFilter !== "All") {
      filtered = filtered.filter((e) => e.enrollmentStatus === enrollmentFilter);
    }

    if (resultFilter !== "All") {
      filtered = filtered.filter((e) => e.resultStatus === resultFilter);
    }

    if (departmentFilter !== "All") {
      filtered = filtered.filter((e) => e.department === departmentFilter);
    }

    if (businessUnitFilter !== "All") {
      filtered = filtered.filter((e) => e.businessUnit === businessUnitFilter);
    }

    return filtered;
  }, [employeeProgressData, searchQuery, enrollmentFilter, resultFilter, departmentFilter, businessUnitFilter]);

  const sortedEmployees = useMemo(() => {
    if (!sortConfig.key) return filteredEmployees;

    return [...filteredEmployees].sort((a, b) => {
      let aVal: any = (a as any)[sortConfig.key!];
      let bVal: any = (b as any)[sortConfig.key!];

      if (sortConfig.key === "completedAt") {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      } else if (aVal === null) {
        aVal = sortConfig.direction === "asc" ? Infinity : -Infinity;
      } else if (bVal === null) {
        bVal = sortConfig.direction === "asc" ? Infinity : -Infinity;
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredEmployees, sortConfig]);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedEmployees.slice(start, start + itemsPerPage);
  }, [sortedEmployees, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  const completionPercent = Math.round((info.completed / info.totalEnrolled) * 100);

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      {/* Header */}
      <PageHeader
        title="Training Progress"
        breadcrumbItems={courseProgress(navigate)}
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={() => navigateBack(navigateTo as any, null, ROUTES.TRAINING.COURSE_DETAIL(courseId || ""))}
              className="whitespace-nowrap"
            >
              Back
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" />
              Export
            </Button>
            {completionPercent === 100 && (
              <Button
                variant="outline-emerald"
                size="sm"
                className="gap-1.5"
                onClick={() => setIsESignatureOpen(true)}
              >
                <ShieldCheck className="h-4 w-4" />
                Close & Sign-off
              </Button>
            )}
          </>
        }
      />

      {/* Course Info Card - Compact Design */}
      <div className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl border border-slate-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="inline-flex w-fit items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-2xs font-bold uppercase tracking-wider border border-emerald-100">
                {info.trainingId}
              </span>
              <h2 className="text-sm sm:text-base md:text-lg font-bold leading-snug text-slate-900 break-words sm:truncate">
                {info.title}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-2 mt-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6">
              <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2 sm:border-0 sm:bg-transparent sm:p-0">
                <div className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100/50">
                  <Target className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xs text-slate-500 font-medium uppercase tracking-tight">Requirement</p>
                  <p className="text-xs font-bold text-slate-900 break-words sm:truncate">
                    Passing: ≥ {info.passingScore}{info.passingGradeType === "percentage" ? "%" : "/10"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2 sm:border-0 sm:bg-transparent sm:p-0 lg:border-l lg:pl-4">
                <div className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100/50">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xs text-slate-500 font-medium uppercase tracking-tight">Due Date</p>
                  <p className="text-xs font-bold text-slate-900 break-words sm:truncate">
                    {formatDateUS(info.dueDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2 sm:border-0 sm:bg-transparent sm:p-0 lg:border-l lg:pl-4">
                <div className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100/50">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xs text-slate-500 font-medium uppercase tracking-tight">Time Remaining</p>
                  <p className="text-xs font-bold text-slate-900 break-words sm:truncate">
                    30 Days Left
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Section - Compact Side Placement on Desktop */}
          <div className="w-full shrink-0 rounded-lg border border-slate-100 bg-slate-50/70 p-3 lg:w-56 lg:border-0 lg:border-l lg:bg-transparent lg:p-0 lg:pl-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider break-words">
                Completion: <span className="text-slate-900">{info.completed}</span>/{info.totalEnrolled}
              </span>
              <span className="text-xs font-bold text-emerald-600">
                {completionPercent}%
              </span>
            </div>
            <Progress value={completionPercent} size="sm" variant="success" animated />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
        {/* Completed */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100/50">
              <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 truncate">Completed</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 leading-none">{info.completed}</p>
            </div>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100/50">
              <Clock className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 truncate">In Progress</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 leading-none">{info.inProgress}</p>
            </div>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-red-50 flex items-center justify-center border border-red-100/50">
              <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 truncate">Overdue</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 leading-none">{info.overdue}</p>
            </div>
          </div>
        </div>

        {/* Pass Rate */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-cyan-50 flex items-center justify-center border border-cyan-100/50">
              <Target className="h-5 w-5 md:h-6 md:w-6 text-cyan-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 truncate">Pass Rate</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 leading-none">{info.passRate}%</p>
            </div>
          </div>
        </div>

        {/* Avg. Score */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-purple-50 flex items-center justify-center border border-purple-100/50">
              <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 truncate">Avg. Score</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 leading-none">
                {info.averageScore !== null ? info.averageScore.toFixed(1) : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Content Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="px-4 pt-4 md:p-5 flex flex-col">
          <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
            <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
              <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name, ID, email..."
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

            <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
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
                    placeholder="Search by name, ID, email..."
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

              {/* Enrollment Filter */}
              <Select
                label="Enrollment"
                value={enrollmentFilter}
                onChange={(e) => {
                  setEnrollmentFilter(e.target.value as typeof enrollmentFilter);
                  setCurrentPage(1);
                }}
                options={[
                  ...enrollmentOptions,
                ]}
              />

              {/* Result Status */}
              <Select
                label="Result"
                value={resultFilter}
                onChange={(e) => {
                  setResultFilter(e.target.value as typeof resultFilter);
                  setCurrentPage(1);
                }}
                options={[
                  ...resultOptions,
                ]}
              />

              {/* Department */}
              <Select
                label="Department"
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { label: "All Depts", value: "All" },
                  ...uniqueDepartments.map((d) => ({ label: String(d), value: String(d) })),
                ]}
              />

              {/* Business Unit */}
              <Select
                label="Business Unit"
                value={businessUnitFilter}
                onChange={(e) => {
                  setBusinessUnitFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { label: "All BUs", value: "All" },
                  ...uniqueBusinessUnits.map((bu) => ({ label: String(bu), value: String(bu) })),
                ]}
              />

              <div className="flex items-end pb-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setEnrollmentFilter("All");
                    setResultFilter("All");
                    setDepartmentFilter("All");
                    setBusinessUnitFilter("All");
                    setCurrentPage(1);
                  }}
                  className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative min-h-0 text-left">
          <div className={cn(
            "border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300 min-h-0",
            isDragging && "select-none"
          )}>
            <div className="md:hidden p-3 space-y-3">
              {paginatedEmployees.length === 0 ? (
                <TableEmptyState
                  title="No Results Found"
                  description="No employees match your current filters. Try adjusting your search or filter criteria."
                />
              ) : (
                paginatedEmployees.map((emp, index) => {
                  const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;
                  const scorePassed = emp.score !== null && emp.score >= info.passingScore;

                  return (
                    <div
                      key={emp.userId}
                      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">#{rowNumber}</span>
                            <button
                              type="button"
                              onClick={() => navigateTo(`${ROUTES.TRAINING.COURSE_RESULT_ENTRY(courseId || "")}`)}
                              className="text-xs font-semibold text-emerald-600 hover:underline"
                            >
                              {emp.userId}
                            </button>
                            <span className="text-xs text-slate-500 truncate">{emp.position}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 mt-1">{emp.fullName}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="text-slate-500">Department</p>
                          <p className="font-medium text-slate-900 mt-0.5">{emp.department}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="text-slate-500">Business Unit</p>
                          <p className="font-medium text-slate-900 mt-0.5">{emp.businessUnit}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          color={
                            emp.enrollmentStatus === "Completed" ? "emerald" :
                              emp.enrollmentStatus === "In-Progress" ? "blue" :
                                emp.enrollmentStatus === "Overdue" ? "red" :
                                  "slate"
                          }
                          size="sm"
                        >
                          {emp.enrollmentStatus}
                        </Badge>
                        <Badge
                          color={emp.resultStatus === "Pass" ? "emerald" : emp.resultStatus === "Fail" ? "red" : "slate"}
                          size="sm"
                        >
                          {emp.resultStatus}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-slate-200 px-3 py-2">
                          <p className="text-slate-500">Score</p>
                          <p className={cn("font-semibold mt-0.5", emp.score === null ? "text-slate-400" : scorePassed ? "text-emerald-700" : "text-red-600")}>
                            {emp.score !== null ? `${emp.score}/${info.passingGradeType === "percentage" ? 100 : 10}` : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 px-3 py-2">
                          <p className="text-slate-500">Completed At</p>
                          <p className="font-semibold text-slate-900 mt-0.5">
                            {emp.completedAt ? formatDateUS(emp.completedAt) : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">Evidence</p>
                          <p className="text-xs font-medium text-slate-700 mt-0.5">
                            {emp.enrollmentStatus === "Completed" ? "Exam scan available" : "No evidence"}
                          </p>
                        </div>
                        {emp.enrollmentStatus === "Completed" ? (
                          <button
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700"
                            onClick={() => alert("Opening Exam Scan...")}
                          >
                            <Paperclip className="h-4 w-4" />
                            View
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div
              ref={scrollerRef}
              className={cn(
                "hidden md:block flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400 transition-colors",
                isDragging ? "cursor-grabbing select-none" : "cursor-grab"
              )}
              {...dragEvents}
            >
              <table className="w-full  border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-20 bg-slate-50 py-2.5 px-2 md:py-3.5 md:px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-16">
                      No.
                    </th>
                    {[
                      { label: "Employee ID", id: "userId" },
                      { label: "Name", id: "name" },
                      { label: "Email", id: "email", hidden: "hidden lg:table-cell" },
                      { label: "Department", id: "department", hidden: "hidden md:table-cell" },
                      { label: "Business Unit", id: "businessUnit", hidden: "hidden lg:table-cell" },
                      { label: "Enrollment", id: "enrollmentStatus", align: "text-center" },
                      { label: "Score", id: "score", align: "text-center" },
                      { label: "Result", id: "resultStatus", align: "text-center" },
                      { label: "Attempts", id: "attempts", align: "text-center", hidden: "hidden lg:table-cell" },
                      { label: "Completed At", id: "completedAt", hidden: "hidden xl:table-cell" },
                      { label: "Evidence", id: null, align: "text-center", sortable: false }
                    ].map((col, idx) => {
                      const isSorted = sortConfig.key === col.id;
                      const canSort = col.id !== null && col.sortable !== false;
                      return (
                        <th
                          key={idx}
                          onClick={canSort ? () => handleSort(col.id!) : undefined}
                          className={cn(
                            "sticky top-0 z-20 bg-slate-50 py-2.5 px-2 md:py-3.5 md:px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors",
                            canSort && "cursor-pointer hover:bg-slate-100 hover:text-slate-700 group",
                            col.align || "text-left",
                            col.hidden
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="truncate">{col.label}</span>
                            {canSort && (
                              <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                                <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === 'asc' ? "text-emerald-600" : "")} />
                                <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === 'desc' ? "text-emerald-600" : "")} />
                              </div>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="sticky top-0 right-0 z-30 bg-slate-50 py-2.5 px-2 md:py-3.5 md:px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={13}>
                        <TableEmptyState
                          title="No Results Found"
                          description="No employees match your current filters. Try adjusting your search or filter criteria."
                        />
                      </td>
                    </tr>
                  ) : (
                    paginatedEmployees.map((emp, index) => {
                      const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;
                      const tdClass = "py-2.5 px-2 md:py-3.5 md:px-4 text-xs md:text-sm text-slate-700 border-b border-slate-200 whitespace-nowrap";
                      return (
                        <tr key={emp.userId} className="hover:bg-slate-50/80 transition-colors group">
                          <td className={cn(tdClass, "text-center text-slate-500 font-medium")}>
                            {rowNumber}
                          </td>
                          <td className={tdClass}>
                            <span className="font-medium text-emerald-600 hover:underline hover:underline">{emp.userId}</span>
                          </td>
                          <td className={tdClass}>
                            <div>
                              <p className="font-medium text-slate-900">{emp.fullName}</p>
                              <p className="text-2xs md:text-xs text-slate-500 mt-0.5">{emp.position}</p>
                            </div>
                          </td>
                          <td className={cn(tdClass, "text-slate-600 hidden lg:table-cell")}>
                            {emp.email}
                          </td>
                          <td className={cn(tdClass, "text-slate-700 hidden md:table-cell")}>
                            {emp.department}
                          </td>
                          <td className={cn(tdClass, "text-slate-700 hidden lg:table-cell")}>
                            {emp.businessUnit}
                          </td>
                          <td className={cn(tdClass, "text-center")}>
                            <Badge
                              color={
                                emp.enrollmentStatus === "Completed" ? "emerald" :
                                  emp.enrollmentStatus === "In-Progress" ? "blue" :
                                    emp.enrollmentStatus === "Overdue" ? "red" :
                                      "slate"
                              }
                              size="sm"
                            >
                              {emp.enrollmentStatus}
                            </Badge>
                          </td>
                          <td className={cn(tdClass, "text-center")}>
                            {emp.score !== null ? (
                              <span
                                className={cn(
                                  "font-bold",
                                  emp.score >= info.passingScore
                                    ? "text-emerald-700"
                                    : "text-red-600"
                                )}
                              >
                                {emp.score}/{info.passingGradeType === "percentage" ? 100 : 10}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className={cn(tdClass, "text-center")}>
                            <Badge
                              color={emp.resultStatus === "Pass" ? "emerald" : emp.resultStatus === "Fail" ? "red" : "slate"}
                              size="sm"
                            >
                              {emp.resultStatus}
                            </Badge>
                          </td>
                          <td className={cn(tdClass, "text-center text-slate-700 hidden lg:table-cell")}>
                            {emp.attempts > 0 ? emp.attempts : "—"}
                          </td>
                          <td className={cn(tdClass, "text-slate-700 hidden xl:table-cell")}>
                            {emp.completedAt ? formatDateUS(emp.completedAt) : "—"}
                          </td>
                          <td className={cn(tdClass, "text-center")}>
                            {emp.enrollmentStatus === "Completed" ? (
                              <button
                                className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-200 transition-colors"
                                title="View Exam Scan"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  alert("Opening Exam Scan...");
                                }}
                              >
                                <Paperclip className="h-4 w-4" />
                              </button>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="sticky right-0 z-10 bg-white border-b border-slate-200 py-2.5 px-2 md:py-3.5 md:px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors">
                            <button
                              ref={getRef(emp.userId)}
                              onClick={(e) => handleDropdownToggle(emp.userId, e)}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-slate-200 transition-colors"
                              aria-label="More actions"
                            >
                              <MoreVertical className="h-4 w-4 text-slate-600" />
                            </button>
                            <EmployeeDropdownMenu
                              employee={emp}
                              courseId={courseId || ""}
                              isOpen={openDropdownId === emp.userId}
                              onClose={() => closeDropdown()}
                              position={dropdownPosition}
                              onNavigate={navigateTo}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredEmployees.length > 0 && (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredEmployees.length}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
                showItemCount={true}
              />
            )}
          </div>
        </div>
      </div>

      {/* ─── Sign-off Modal ──────────────────────────────────── */}
      <ESignatureModal
        isOpen={isESignatureOpen}
        onClose={() => setIsESignatureOpen(false)}
        onConfirm={async (signature) => {
          console.log("Course archived with signature:", signature);
          setIsESignatureOpen(false);
        }}
        actionTitle="Training Batch Sign-off"
      />

      {/* ─── Loading Overlay ──────────────────────────────────── */}
      {isNavigating && <FullPageLoading text="Loading..." />}

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Enrollment"
          isExpanded={expandedSections.has("enrollment")}
          onToggle={() => toggleSection("enrollment")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {enrollmentOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setEnrollmentFilter(opt.value as EnrollmentStatus | "All");
                  setCurrentPage(1);
                }}
                className={getOptionClassName(enrollmentFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {enrollmentFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Result"
          isExpanded={expandedSections.has("result")}
          onToggle={() => toggleSection("result")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {resultOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setResultFilter(opt.value as ResultStatus | "All");
                  setCurrentPage(1);
                }}
                className={getOptionClassName(resultFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {resultFilter === opt.value && <Check size={16} className="text-emerald-500" />}
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
            {[{ label: "All Depts", value: "All" }, ...uniqueDepartments.map((d) => ({ label: String(d), value: String(d) }))].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setDepartmentFilter(opt.value);
                  setCurrentPage(1);
                }}
                className={getOptionClassName(departmentFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {departmentFilter === opt.value && <Check size={16} className="text-emerald-500" />}
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
            {[{ label: "All BUs", value: "All" }, ...uniqueBusinessUnits.map((bu) => ({ label: String(bu), value: String(bu) }))].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setBusinessUnitFilter(opt.value);
                  setCurrentPage(1);
                }}
                className={getOptionClassName(businessUnitFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {businessUnitFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>

      {isNavigating && <FullPageLoading text="Loading..." />}
    </div>
  );
};


