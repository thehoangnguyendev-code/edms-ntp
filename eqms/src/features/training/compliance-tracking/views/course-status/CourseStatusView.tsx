import React, { useState, useMemo, useCallback, useEffect } from "react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import {
  Search,
  Users,
  CheckCircle2,
  Clock,
  Download,
  TrendingUp,
  GraduationCap,
  MoreVertical,
  ClipboardList,
  Archive,
  Send,
  Mail,
  Smartphone,
  Info,
  ShieldCheck,
  AlertCircle,
  X,
  ChevronUp,
  ChevronDown,
  Check,
} from "lucide-react";
import { IconBellRinging, IconFilter2, IconTimeline } from "@tabler/icons-react";
import { Badge, Progress } from "@/components/ui";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { courseStatus } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { FormModal } from "@/components/ui/modal/FormModal";
import { AlertModal, AlertModalType } from "@/components/ui/modal/AlertModal";
import { ESignatureModal } from "@/components/ui/esign-modal";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SectionLoading, FullPageLoading } from "@/components/ui/loading";
import { cn } from "@/components/ui/utils";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { usePortalDropdown, useNavigateWithLoading, useTableDragScroll } from "@/hooks";
import type { PortalDropdownPosition, UsePortalDropdownReturn } from "@/hooks";
import type { CourseComplianceRecord, CourseStatusFilters } from "../../../types";
import { complianceTrackingRepository } from "../../repository";

// --- Sub-components ---
const CourseRow: React.FC<{
  course: CourseComplianceRecord;
  index: number;
  currentPage: number;
  itemsPerPage: number;
  onViewProgress: (id: string) => void;
  showDetailList: (course: CourseComplianceRecord, type: "Total" | "Completed" | "InProgress" | "Overdue") => void;
  getRef: UsePortalDropdownReturn["getRef"];
  handleDropdownToggle: UsePortalDropdownReturn["toggle"];
  openDropdownId: string | null;
  closeDropdown: () => void;
  dropdownPosition: PortalDropdownPosition;
  handleCloseArchive: (course: CourseComplianceRecord) => void;
  handleResultEntry: (id: string) => void;
}> = React.memo(({
  course,
  index,
  currentPage,
  itemsPerPage,
  onViewProgress,
  showDetailList,
  getRef,
  handleDropdownToggle,
  openDropdownId,
  closeDropdown,
  dropdownPosition,
  handleCloseArchive,
  handleResultEntry,
}) => {
  const getCompletionRate = (course: CourseComplianceRecord) => {
    return Math.round((course.completed / course.totalAssigned) * 100);
  };

  const getCompletionColor = (rate: number): string => {
    if (rate >= 90) return "text-emerald-600";
    if (rate >= 70) return "text-blue-600";
    if (rate >= 50) return "text-amber-600";
    return "text-red-600";
  };

  const completionRate = getCompletionRate(course);
  const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;

  return (
    <tr
      key={course.id}
      className="hover:bg-slate-50/80 transition-colors group"
    >
      <td className="py-2.5 px-2 md:py-3.5 md:px-4 text-xs md:text-sm text-center text-slate-500 font-medium border-b border-slate-200">
        {rowNumber}
      </td>
      <td
        className={cn("py-2.5 px-2 md:py-3.5 md:px-4 text-xs md:text-sm whitespace-nowrap border-b border-slate-200 cursor-pointer")}
        onClick={() => onViewProgress(course.id)}
      >
        <span className="font-medium text-emerald-600 hover:underline hover:underline">{course.courseId}</span>
      </td>
      <td className="py-2.5 px-2 md:py-3.5 md:px-4 text-xs md:text-sm border-b border-slate-200">
        <div className="flex items-start gap-2">
          <GraduationCap className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-slate-900 whitespace-nowrap">
              {course.courseName}
            </p>
            <p className="text-2xs md:text-xs text-slate-500 mt-1 whitespace-nowrap">
              {course.description}
            </p>
          </div>
        </div>
      </td>
      <td className="py-2.5 px-2 md:py-3.5 md:px-4 text-xs md:text-sm border-b border-slate-200">
        <Badge color="blue" size="sm">
          {course.courseType}
        </Badge>
      </td>
      <td className="py-2.5 px-2 md:py-3.5 md:px-4 text-xs md:text-sm border-b border-slate-200">
        <div
          className="flex items-center gap-2 hover:bg-slate-100 p-1 rounded transition-colors group/stat"
          onClick={(e) => {
            e.stopPropagation();
            onViewProgress(course.id);
          }}
        >
          <Users className="h-4 w-4 text-slate-400 group-hover/stat:text-slate-600" />
          <span className="text-slate-900 font-semibold border-b border-transparent group-hover/stat:border-slate-400">
            {course.totalAssigned}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-2 md:py-3.5 md:px-4 text-xs md:text-sm border-b border-slate-200 text-emerald-700">
        <div
          onClick={(e) => { e.stopPropagation(); showDetailList(course, "Completed"); }}
          className="flex items-center gap-2 hover:bg-emerald-50 p-1 rounded transition-colors group/stat"
        >
          <span className="font-semibold border-b border-transparent group-hover/stat:border-emerald-600">
            {course.completed}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-2 md:py-3.5 md:px-4 text-xs md:text-sm border-b border-slate-200 text-blue-700">
        <div
          onClick={(e) => { e.stopPropagation(); showDetailList(course, "InProgress"); }}
          className="flex items-center gap-2 hover:bg-blue-50 p-1 rounded transition-colors group/stat"
        >
          <span className="font-semibold border-b border-transparent group-hover/stat:border-blue-600">
            {course.inProgress}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-2 md:py-3.5 md:px-4 text-xs md:text-sm border-b border-slate-200 text-red-700">
        <div
          onClick={(e) => { e.stopPropagation(); showDetailList(course, "Overdue"); }}
          className="flex items-center gap-2 hover:bg-red-50 p-1 rounded transition-colors group/stat"
        >
          <span className="font-semibold border-b border-transparent group-hover/stat:border-red-600">
            {course.overdue}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-2 md:py-3.5 md:px-4 text-xs md:text-sm border-b border-slate-200 font-semibold text-slate-900">
        {course.averageScore}%
      </td>
      <td className="py-2.5 px-2 md:py-3.5 md:px-4 text-xs md:text-sm border-b border-slate-200 min-w-[120px]">
        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-[80px]">
            <Progress
              value={completionRate}
              size="xs"
              variant={
                completionRate >= 90 ? "success" :
                  completionRate >= 70 ? "blue" :
                    completionRate >= 50 ? "warning" : "error"
              }
              animated
            />
          </div>
          <span className={cn("font-bold text-2xs md:text-xs truncate", getCompletionColor(completionRate))}>
            {completionRate}%
          </span>
        </div>
      </td>
      <td
        className="sticky right-0 bg-white border-b border-slate-200 py-2.5 px-2 md:py-3.5 md:px-4 text-center z-10 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={getRef(course.id)}
          onClick={(e) => handleDropdownToggle(course.id, e)}
          className="h-8 w-8 mx-auto rounded-lg hover:bg-slate-200 flex items-center justify-center transition-colors"
        >
          <MoreVertical className="h-4 w-4 text-slate-500" />
        </button>
        <CourseActionMenu
          course={course}
          isOpen={openDropdownId === course.id}
          onClose={closeDropdown}
          position={dropdownPosition}
          onViewProgress={onViewProgress}
          onResultEntry={handleResultEntry}
          onCloseArchive={handleCloseArchive}
        />
      </td>
    </tr>
  );
});

interface CourseActionMenuProps {
  course: CourseComplianceRecord;
  isOpen: boolean;
  onClose: () => void;
  position: PortalDropdownPosition;
  onViewProgress: (id: string) => void;
  onResultEntry: (id: string) => void;
  onCloseArchive: (course: CourseComplianceRecord) => void;
}

const CourseActionMenu: React.FC<CourseActionMenuProps> = ({
  course,
  isOpen,
  onClose,
  position,
  onViewProgress,
  onResultEntry,
  onCloseArchive,
}) => {
  if (!isOpen) return null;

  const completionRate = Math.round((course.completed / course.totalAssigned) * 100);

  return (
    <PortalDropdownMenu isOpen={isOpen} onClose={onClose} position={position} minWidth={180}>
      <div className="py-1">
        {/* View Progress - Always visible */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewProgress(course.id);
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <IconTimeline className="h-4 w-4 text-slate-500" />
          View Progress
        </button>

        {/* Result Entry - Only if in progress or has incomplete status */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onResultEntry(course.id);
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <ClipboardList className="h-4 w-4 text-slate-500" />
          Result Entry
        </button>

        {/* Close & Archive - Only if 100% completion */}
        {completionRate === 100 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseArchive(course);
                onClose();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Archive className="h-4 w-4 text-slate-500" />
              Close & Archive
            </button>
          </>
        )}
      </div>
    </PortalDropdownMenu>
  );
};

// --- Main Component ---

export const CourseStatusView: React.FC = () => {
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const courseStatusData = complianceTrackingRepository.getCourseStatusData();


  // Filters
  const [filters, setFilters] = useState<CourseStatusFilters>({
    searchQuery: "",
    departmentFilter: "All",
    typeFilter: "All",
  });
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["department", "type"]));

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: "asc" | "desc" }>({
    key: "courseId",
    direction: "asc",
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const { openId: openDropdownId, position: dropdownPosition, getRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();

  // Sorting Handler
  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };


  // Details Modal State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsModalType, setDetailsModalType] = useState<
    "Total" | "Completed" | "InProgress" | "Overdue"
  >("Total");
  const [selectedCourse, setSelectedCourse] =
    useState<CourseComplianceRecord | null>(null);

  // Reminders State
  const [isRemindersModalOpen, setIsRemindersModalOpen] = useState(false);
  const [isSendingReminders, setIsSendingReminders] = useState(false);

  // Archive & E-Sign State
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isESignOpen, setIsESignOpen] = useState(false);

  // Reminders Selection State
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);

  // Feedback State
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    type: AlertModalType;
    title: string;
    description: string;
  }>({ type: "info", title: "", description: "" });

  const departmentOptions = [
    { label: "All Departments", value: "All" },
    { label: "Quality Assurance", value: "Quality Assurance" },
    { label: "QC Lab", value: "QC Lab" },
    { label: "Documentation", value: "Documentation" },
  ];

  const typeOptions = [
    { label: "All Types", value: "All" },
    { label: "GMP", value: "GMP" },
    { label: "Technical", value: "Technical" },
    { label: "Compliance", value: "Compliance" },
    { label: "SOP", value: "SOP" },
  ];

  const clearFilters = () => {
    setFilters({
      searchQuery: "",
      departmentFilter: "All",
      typeFilter: "All",
    });
    setCurrentPage(1);
  };

  const handleClearFilters = clearFilters;

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

  // Filtered Data
  const filteredData = useMemo(() => {
    return courseStatusData.filter((course) => {
      const matchesSearch =
        course.courseName
          .toLowerCase()
          .includes(filters.searchQuery.toLowerCase()) ||
        course.courseId.toLowerCase().includes(filters.searchQuery.toLowerCase());
      const matchesDepartment =
        filters.departmentFilter === "All" ||
        course.department === filters.departmentFilter;
      const matchesType =
        filters.typeFilter === "All" || course.courseType === filters.typeFilter;

      return matchesSearch && matchesDepartment && matchesType;
    });
  }, [courseStatusData, filters]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aVal: any = (a as any)[sortConfig.key!];
      let bVal: any = (b as any)[sortConfig.key!];

      if (sortConfig.key === "completion") {
        aVal = a.completed / a.totalAssigned;
        bVal = b.completed / b.totalAssigned;
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  // Memoized stats for dashboard
  const stats = useMemo(() => {
    const totalCourses = courseStatusData.length;
    const totalAssigned = courseStatusData.reduce((sum, c) => sum + c.totalAssigned, 0);
    const completed = courseStatusData.reduce((sum, c) => sum + c.completed, 0);
    const avgScore = totalCourses > 0
      ? Math.round(courseStatusData.reduce((sum, c) => sum + c.averageScore, 0) / totalCourses)
      : 0;

    return { totalCourses, totalAssigned, completed, avgScore };
  }, [courseStatusData]);

  // --- Handlers ---
  const handleViewProgress = useCallback((courseId: string) => {
    navigateTo(ROUTES.TRAINING.COURSE_PROGRESS(courseId));
  }, [navigateTo]);

  const handleResultEntry = useCallback((courseId: string) => {
    navigateTo(ROUTES.TRAINING.COURSE_RESULT_ENTRY(courseId));
  }, [navigateTo]);

  const handleCloseArchive = useCallback((course: CourseComplianceRecord) => {
    setSelectedCourse(course);
    setIsArchiveModalOpen(true);
  }, []);

  const handleDetailList = useCallback((
    course: CourseComplianceRecord,
    type: "Total" | "Completed" | "InProgress" | "Overdue"
  ) => {
    setSelectedCourse(course);
    setDetailsModalType(type);
    setIsDetailsModalOpen(true);
  }, []);

  const handleConfirmArchive = () => {
    setIsArchiveModalOpen(false);
    setIsESignOpen(true);
  };

  const handleESignSuccess = async () => {
    setAlertConfig({
      type: "success",
      title: "Course Archived",
      description: `The course "${selectedCourse?.courseName}" has been successfully closed and archived for audit.`,
    });
    setAlertOpen(true);
    setIsESignOpen(false);
  };

  const handleSendReminders = async () => {
    setIsSendingReminders(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsSendingReminders(false);
    setIsRemindersModalOpen(false);
    setAlertConfig({
      type: "success",
      title: "Reminders Sent",
      description: `Notifications have been sent to ${selectedEmployees.length || 30} selected employees.`,
    });
    setAlertOpen(true);
  };

  const toggleEmployeeSelection = (id: string) => {
    setSelectedEmployees(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllAffected = (ids: string[]) => {
    if (selectedEmployees.length === ids.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(ids);
    }
  };

  // Mock employee list for details modal
  const getMockEmployees = (type: string) => {
    const list = [
      { id: "EMP-1002", fullName: "Nguyen Van An", dept: "QA", status: "Completed", date: "15/03/2026" },
      { id: "EMP-1005", fullName: "Tran Thi Binh", dept: "QC", status: "In Progress", date: "-" },
      { id: "EMP-1010", fullName: "Le Van Cuong", dept: "Production", status: "Overdue", date: "01/03/2026" },
      { id: "EMP-1012", fullName: "Pham Thi Dung", dept: "Documentation", status: "Completed", date: "12/03/2026" },
      { id: "EMP-1015", fullName: "Hoang Van Em", dept: "Engineering", status: "In Progress", date: "-" },
    ];

    if (type === "Completed") return list.filter(e => e.status === "Completed");
    if (type === "InProgress") return list.filter(e => e.status === "In Progress");
    if (type === "Overdue") return list.filter(e => e.status === "Overdue");
    return list;
  };

  if (isLoading) return <SectionLoading minHeight="60vh" />;

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      {/* Header */}
      <PageHeader
        title="Course Status"
        breadcrumbItems={courseStatus(navigateTo)}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => console.log("Export status")}
              variant="outline"
              size="sm"
              className="whitespace-nowrap gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              onClick={() => setIsRemindersModalOpen(true)}
              variant="default"
              size="sm"
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Send Reminders
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        {/* Total Courses */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100/50">
              <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 truncate">Total Courses</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 leading-none">{stats.totalCourses}</p>
            </div>
          </div>
        </div>

        {/* Total Assigned */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100/50">
              <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 truncate">Total Assigned</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 leading-none">{stats.totalAssigned}</p>
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100/50">
              <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 truncate">Completed</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 leading-none">{stats.completed}</p>
            </div>
          </div>
        </div>

        {/* Avg. Score */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100/50">
              <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 truncate">Avg. Score</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900 leading-none">{stats.avgScore}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Content Card */}
      <div className="bg-white rounded-xl border border-slate-200 w-full overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Filter Section */}
        <div className="px-4 pt-4 md:p-5 flex flex-col">
          {/* Mobile Filter UI */}
          <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by course name or ID..."
                  value={filters.searchQuery}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, searchQuery: e.target.value }));
                    setCurrentPage(1);
                  }}
                  className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                />
                {filters.searchQuery && (
                  <button
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, searchQuery: "" }));
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

          {/* Search & Filters Row */}
          <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block transition-colors">
                Search
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
                  <Search className="h-4 w-4 text-slate-400 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search by course name or ID..."
                  value={filters.searchQuery}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
                  }
                  className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
                />
                {filters.searchQuery && (
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, searchQuery: "" }))}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <Select
              label="Department"
              value={filters.departmentFilter}
              onChange={(val) => {
                setFilters((prev) => ({ ...prev, departmentFilter: val }));
                setCurrentPage(1);
              }}
              options={departmentOptions}
            />

            <Select
              label="Type"
              value={filters.typeFilter}
              onChange={(val) => {
                setFilters((prev) => ({ ...prev, typeFilter: val }));
                setCurrentPage(1);
              }}
              options={typeOptions}
            />

            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative min-h-0">
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden flex flex-col flex-1 transition-all duration-300">
            <div
              ref={scrollerRef}
              className={cn(
                "flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400 transition-colors",
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
                      { label: "Course ID", id: "courseId" },
                      { label: "Course Name", id: "courseName" },
                      { label: "Type", id: "courseType" },
                      { label: "Total Assigned", id: "totalAssigned" },
                      { label: "Completed", id: "completed" },
                      { label: "In Progress", id: "inProgress" },
                      { label: "Overdue", id: "overdue" },
                      { label: "Avg. Score", id: "averageScore" },
                      { label: "Completion", id: "completion" }
                    ].map((col, idx) => {
                      const isSorted = sortConfig.key === col.id;
                      return (
                        <th
                          key={idx}
                          onClick={() => handleSort(col.id)}
                          className={cn(
                            "sticky top-0 z-20 bg-slate-50 py-2.5 px-2 md:py-3.5 md:px-4 text-2xs font-bold uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors group",
                            "text-slate-500"
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
                    <th className="sticky top-0 right-0 z-30 bg-slate-50 py-2.5 px-2 md:py-3.5 md:px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedData.map((course, index) => (
                    <CourseRow
                      key={course.id}
                      course={course}
                      index={index}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      onViewProgress={handleViewProgress}
                      showDetailList={handleDetailList}
                      getRef={getRef}
                      handleDropdownToggle={handleDropdownToggle}
                      openDropdownId={openDropdownId}
                      closeDropdown={closeDropdown}
                      dropdownPosition={dropdownPosition}
                      handleCloseArchive={handleCloseArchive}
                      handleResultEntry={handleResultEntry}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredData.length}
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

      {/* --- Modals --- */}

      {/* Employee Details Modal */}
      <FormModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`${detailsModalType} Employees - ${selectedCourse?.courseName}`}
        showCancel={false}
        confirmText="Close"
        size="xl"
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-4 text-2xs sm:text-sm text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">{selectedCourse?.courseId}</span>
            </div>
            <div className="h-3 w-[1px] bg-slate-200" />
            <span>{selectedCourse?.totalAssigned} Total Participants</span>
          </div>

          <div className="border rounded-lg flex-1 overflow-auto scrollbar-always-visible scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 hover:scrollbar-thumb-slate-400 scrollbar-thumb-rounded-full scrollbar-track-rounded-full pb-1.5">
            <table className="w-full text-2xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase tracking-wider text-2xs md:text-xs whitespace-nowrap">Employee ID</th>
                  <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase tracking-wider text-2xs md:text-xs whitespace-nowrap">Name</th>
                  <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase tracking-wider text-2xs md:text-xs whitespace-nowrap">Department</th>
                  <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase tracking-wider text-2xs md:text-xs whitespace-nowrap">Status</th>
                  <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase tracking-wider text-2xs md:text-xs whitespace-nowrap">Completed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {getMockEmployees(detailsModalType).map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-emerald-600 hover:underline whitespace-nowrap">
                      <a
                        href={ROUTES.SETTINGS.USERS_PROFILE(emp.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {emp.id}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-semibold whitespace-nowrap">{emp.fullName}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{emp.dept}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        color={emp.status === "Completed" ? "emerald" : emp.status === "In Progress" ? "blue" : "red"}
                        size="sm"
                      >
                        {emp.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{emp.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </FormModal>

      <FormModal
        isOpen={isRemindersModalOpen}
        onClose={() => setIsRemindersModalOpen(false)}
        title="Send Training Reminders"
        description="Notify employees who are currently in progress or overdue."
        confirmText="Send Notifications"
        onConfirm={handleSendReminders}
        isLoading={isSendingReminders}
        size="lg"
      >
        <div className="space-y-5 sm:space-y-6">
          {/* Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3">
                <span className="text-lg sm:text-xl font-bold text-red-600">8</span>
                <Badge color="red" size="sm">Overdue</Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg sm:text-xl font-bold text-blue-600">22</span>
                <Badge color="blue" size="sm">In Progress</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-medium text-slate-700">Affected Employees</label>
              <button
                onClick={() => selectAllAffected(["EMP-1010", "EMP-1005", "EMP-1015", "EMP-1022", "EMP-1033", "EMP-1045"])}
                className="text-2xs sm:text-xs text-emerald-600 font-semibold hover:underline transition-colors"
              >
                {selectedEmployees.length === 6 ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="max-h-[240px] overflow-y-auto pr-2 space-y-2 border border-slate-200 rounded-lg p-2 custom-scrollbar bg-white/50">
              {[
                { id: "EMP-1010", fullName: "Le Van Cuong", dept: "Production", title: "Senior Operator", status: "Overdue" },
                { id: "EMP-1005", fullName: "Tran Thi Binh", dept: "QC", title: "Lab Technician", status: "In Progress" },
                { id: "EMP-1015", fullName: "Hoang Van Em", dept: "Engineering", title: "Maintenance Specialist", status: "In Progress" },
                { id: "EMP-1022", fullName: "Dang Van Hung", dept: "Maintenance", title: "Junior Engineer", status: "Overdue" },
                { id: "EMP-1033", fullName: "Nguyen Thu Huong", dept: "QA", title: "Quality Specialist", status: "In Progress" },
                { id: "EMP-1045", fullName: "Tran Xuan Bac", dept: "Warehouse", title: "Staff", status: "Overdue" },
              ].map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => toggleEmployeeSelection(emp.id)}
                  className={cn(
                    "flex items-center justify-between p-2.5 border rounded-lg transition-all cursor-pointer",
                    selectedEmployees.includes(emp.id)
                      ? "border-emerald-500 bg-emerald-50/50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedEmployees.includes(emp.id)}
                      onChange={() => toggleEmployeeSelection(emp.id)}
                    />
                    <div className="flex flex-col">
                      <span className="text-2xs sm:text-sm font-semibold text-slate-700">{emp.fullName}</span>
                      <span className="text-2xs sm:text-xs text-slate-500 font-medium">{emp.id} • {emp.title} • {emp.dept}</span>
                    </div>
                  </div>
                  <Badge
                    color={emp.status === "Overdue" ? "red" : "blue"}
                    size="sm"
                  >
                    {emp.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block">Delivery Methods</label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all cursor-pointer group">
                <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-100 transition-colors shrink-0">
                  <IconBellRinging className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 text-2xs sm:text-sm truncate">Push Notification</p>
                </div>
                <Checkbox checked={notifyPush} onChange={setNotifyPush} className="shrink-0" />
              </label>

              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all cursor-pointer group">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 group-hover:bg-blue-100 transition-colors shrink-0">
                  <Mail className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 text-2xs sm:text-sm truncate">Email Delivery</p>
                </div>
                <Checkbox checked={notifyEmail} onChange={setNotifyEmail} className="shrink-0" />
              </label>
            </div>
          </div>
        </div>
      </FormModal>

      {/* Archive Confirmation Modal */}
      <FormModal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        onConfirm={handleConfirmArchive}
        title="Close & Archive Course"
        confirmText="Confirm & Archive"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-amber-900">Archive Confirmation</p>
              <p className="text-2xs sm:text-xs text-amber-800 mt-1">
                You are about to close <span className="font-bold underline">{selectedCourse?.courseName}</span>.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-2xs sm:text-xs font-semibold text-slate-700 uppercase tracking-wider">Historical records will be:</p>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-600 list-disc pl-5 marker:text-slate-400">
              <li><span>Locked for all future result entries.</span></li>
              <li><span>Moved to the Audit-Ready Training Archive.</span></li>
              <li><span>Marked as permanently completed.</span></li>
            </ul>
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
            <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-2xs sm:text-xs text-blue-800 font-medium">
              This action requires an Electronic Signature for compliance.
            </p>
          </div>
        </div>
      </FormModal>

      {/* Electronic Signature Modal */}
      <ESignatureModal
        isOpen={isESignOpen}
        onClose={() => setIsESignOpen(false)}
        onConfirm={handleESignSuccess}
        actionTitle={`Close and Archive Training Course ID: ${selectedCourse?.courseId}`}
      />

      {/* Global Alert */}
      <AlertModal
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        type={alertConfig.type}
        title={alertConfig.title}
        description={alertConfig.description}
      />

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
          label="Type"
          isExpanded={expandedSections.has("type")}
          onToggle={() => toggleSection("type")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setFilters((prev) => ({ ...prev, typeFilter: opt.value }));
                  setCurrentPage(1);
                }}
                className={getOptionClassName(filters.typeFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {filters.typeFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>

      {isNavigating && <FullPageLoading text="Loading..." />}
    </div>
  );
};




