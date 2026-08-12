import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, X, GraduationCap, ChevronUp, ChevronDown, MoreVertical } from "lucide-react";
import { IconClock, IconInfoCircle } from "@tabler/icons-react";
import { Select } from "@/components/ui/select/Select";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form";
import { Button } from "@/components/ui/button/Button";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { cn } from "@/components/ui/utils";
import { useTableDragScroll, usePortalDropdown, PortalDropdownPosition } from "@/hooks";
import { ROUTES } from "@/app/routes.constants";
import { CATEGORY_OPTIONS, METHOD_OPTIONS, ApprovedCourse } from "../AssignTrainingView";

interface CourseDropdownMenuProps {
  course: ApprovedCourse;
  isOpen: boolean;
  onClose: () => void;
  position: PortalDropdownPosition;
  onNavigate: (path: string) => void;
}

const CourseDropdownMenu: React.FC<CourseDropdownMenuProps> = ({
  course,
  isOpen,
  onClose,
  position,
  onNavigate,
}) => {
  if (!isOpen) return null;

  type MenuItem =
    | { isDivider: true }
    | { isDivider?: false; icon: React.ElementType; label: string; onClick: () => void; color?: string };

  const menuItems: MenuItem[] = [
    { icon: IconInfoCircle, label: "View Detail", onClick: () => { onNavigate(`${ROUTES.TRAINING.COURSE_DETAIL(course.id)}?from=assignment`); onClose(); }, color: "text-slate-500" },
  ];

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 animate-in fade-in duration-150"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-hidden="true"
      />
      <div
        className="absolute z-50 min-w-[160px] w-[200px] max-w-[90vw] max-h-[300px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
        style={position.style}
      >
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
                onClick={(e) => { e.stopPropagation(); mi.onClick(); }}
                className={cn("flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 active:bg-slate-100 transition-colors", mi.color)}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium">{mi.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>,
    window.document.body
  );
};

export interface Step1Props {
  courses: ApprovedCourse[];
  selectedCourseId: string | null;
  onSelectCourse: (id: string) => void;
  courseSearch: string;
  onSearchChange: (v: string) => void;
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  methodFilter: string;
  onMethodChange: (v: string) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  selectedCourse: ApprovedCourse | null;
  navigateTo: (path: any) => void;
}

export const Step1CourseSelect: React.FC<Step1Props> = ({
  courses,
  selectedCourseId,
  onSelectCourse,
  courseSearch,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  methodFilter,
  onMethodChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  selectedCourse,
  navigateTo,
}) => {
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { openId: openDropdownId, position: dropdownPosition, getRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<keyof ApprovedCourse | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [courseSearch, categoryFilter, methodFilter, dateFrom, dateTo]);

  const handleSort = (field: keyof ApprovedCourse) => {
    if (sortField === field) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else {
        setSortField(null);
        setSortOrder('asc');
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedCourses = useMemo(() => {
    if (!sortField) return courses;
    return [...courses].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [courses, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedCourses.length / itemsPerPage);
  const currentCourses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedCourses.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedCourses, currentPage, itemsPerPage]);

  return (
    <FormSection
      title="Choose Training Course"
      icon={<GraduationCap className="h-4 w-4" />}
    >
      <div className="space-y-4">
        {/* Course picker */}
        <div className="space-y-4">
          {/* Filters with adaptive grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3 items-end">
            <div className="flex flex-col">
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={courseSearch}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search courses…"
                  className="w-full h-9 pl-9 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400"
                />
                {courseSearch && (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <Select
              label="Category"
              value={categoryFilter}
              onChange={onCategoryChange}
              options={CATEGORY_OPTIONS}
            />
            <Select
              label="Method"
              value={methodFilter}
              onChange={onMethodChange}
              options={METHOD_OPTIONS}
            />
            <DateRangePicker
              label="Scheduled Date Range"
              startDate={dateFrom}
              onStartDateChange={onDateFromChange}
              endDate={dateTo}
              onEndDateChange={onDateToChange}
              placeholder="Filter by date…"
            />
          </div>

          {/* Course list table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white shadow-sm transition-all duration-300">
            {/* ==================== DESKTOP TABLE VIEW (>= 1024px) ==================== */}
            <div
              ref={scrollerRef}
              className={cn(
                "hidden lg:block flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400 transition-colors",
                isDragging ? "cursor-grabbing select-none" : "cursor-grab"
              )}
              {...dragEvents}
            >
              <table className="w-full min-w-[1000px] border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-20 bg-slate-50 py-3 px-2 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-8">
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-16">
                      No.
                    </th>
                    {[
                      { label: "Course ID", id: "trainingId", width: "w-32" },
                      { label: "Course Name", id: "title", width: "min-w-[200px]" },
                      { label: "Type", id: "type", width: "w-28" },
                      { label: "Method", id: "trainingMethod", width: "w-44" },
                      { label: "Duration", id: "duration", width: "w-24", align: "text-center" },
                      { label: "Pass Score", id: "passScore", width: "w-28", align: "text-center" },
                      { label: "Status", id: "status", width: "w-28", sortable: false },
                      { label: "Instructor", id: "instructor", width: "w-40" },
                      { label: "Scheduled Date", id: "scheduledDate", width: "w-40", sortable: false },
                    ].map((col) => {
                      if (col.sortable === false) {
                        return (
                          <th key={col.id} className={cn("sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap", col.width, col.align || "text-left")}>
                            {col.label}
                          </th>
                        );
                      }
                      const isSorted = sortField === col.id;
                      return (
                        <th
                          key={col.id}
                          onClick={() => handleSort(col.id as keyof ApprovedCourse)}
                          className={cn(
                            "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors group",
                            col.width,
                            col.align || "text-left"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="truncate">{col.label}</span>
                            <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                              <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortOrder === 'asc' ? "text-emerald-600" : "")} />
                              <ChevronDown className={cn("h-3 w-3", isSorted && sortOrder === 'desc' ? "text-emerald-600" : "")} />
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
                  {currentCourses.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p-0">
                        <TableEmptyState
                          icon={<GraduationCap className="h-8 w-8 text-slate-300" />}
                          title="No courses found"
                          description="Try adjusting your search criteria to see more results."
                        />
                      </td>
                    </tr>
                  )}
                  {currentCourses.map((c, idx) => {
                    const tdClass = "py-3 px-4 text-xs md:text-sm text-slate-700 border-b border-slate-200 whitespace-nowrap";
                    return (
                      <tr
                        key={c.id}
                        onClick={() => onSelectCourse(c.id)}
                        className={cn(
                          "hover:bg-slate-50/80 transition-colors cursor-pointer group",
                          selectedCourseId === c.id && "bg-emerald-50/50",
                        )}
                      >
                        <td className="py-3 px-2 border-b border-slate-200 text-center w-8">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={selectedCourseId === c.id}
                              onChange={() => onSelectCourse(c.id)}
                            />
                          </div>
                        </td>
                        <td className={cn(tdClass, "text-center font-medium text-slate-500")}>
                          {(currentPage - 1) * itemsPerPage + idx + 1}
                        </td>
                        <td className={tdClass}>
                          <span className="font-medium text-emerald-600 hover:underline">
                            {c.trainingId}
                          </span>
                        </td>
                        <td className={tdClass}>
                          <div className="flex items-start gap-2">
                            <GraduationCap className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                            <div className="max-w-[200px] md:max-w-md">
                              <p className="font-medium text-slate-900">
                                {c.title}
                              </p>
                              <p className="text-2xs md:text-xs text-slate-500 mt-0.5 truncate">
                                {c.description || "-"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={tdClass}>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
                            {c.type}
                          </span>
                        </td>
                        <td className={tdClass}>
                          {c.trainingMethod}
                        </td>
                        <td className={cn(tdClass, "text-center")}>
                            <span className="font-medium">{c.duration}h</span>
                        </td>
                        <td className={cn(tdClass, "text-center font-semibold text-emerald-600")}>
                          {c.passScore}%
                        </td>
                        <td className={tdClass}>
                          <Badge color="emerald" size="sm" pill>
                            Effective
                          </Badge>
                        </td>
                        <td className={tdClass}>
                          {c.instructor}
                        </td>
                        <td className={tdClass}>
                          25/03/2026
                        </td>
                        <td
                          onClick={(e) => e.stopPropagation()}
                          className="sticky right-0 z-10 bg-white border-b border-slate-200 py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors"
                        >
                          <button
                            ref={getRef(c.id)}
                            onClick={(e) => handleDropdownToggle(c.id, e)}
                            className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 transition-colors"
                            aria-label="More actions"
                          >
                            <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-600" />
                          </button>
                          <CourseDropdownMenu
                            course={c}
                            isOpen={openDropdownId === c.id}
                            onClose={closeDropdown}
                            position={dropdownPosition}
                            onNavigate={navigateTo}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ==================== PREMIUM MOBILE CARD VIEW (< 1024px) ==================== */}
            <div className="block lg:hidden p-4 space-y-3 bg-slate-50/50 max-h-[600px] overflow-y-auto scrollbar-thin">
              {currentCourses.length === 0 ? (
                <TableEmptyState
                  icon={<GraduationCap className="h-8 w-8 text-slate-300" />}
                  title="No courses found"
                  description="Try adjusting your search criteria to see more results."
                />
              ) : (
                currentCourses.map((c, idx) => {
                  const isSelected = selectedCourseId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => onSelectCourse(c.id)}
                      className={cn(
                        "bg-white border rounded-lg p-4 transition-all duration-200 cursor-pointer relative",
                        "hover:shadow-md active:scale-[0.99]",
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500/20"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      {/* Top Bar: Checkbox + Course ID + Action */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-bold text-slate-500">
                            #{(currentPage - 1) * itemsPerPage + idx + 1}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            {c.trainingId}
                          </span>
                        </div>

                        {/* Action Dropdown Button */}
                        <div onClick={(e) => e.stopPropagation()} className="relative">
                          <button
                            ref={getRef(c.id)}
                            onClick={(e) => handleDropdownToggle(c.id, e)}
                            className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center border border-slate-100 bg-white shadow-sm"
                            aria-label="More actions"
                          >
                            <MoreVertical className="h-4 w-4 text-slate-500" />
                          </button>
                          <CourseDropdownMenu
                            course={c}
                            isOpen={openDropdownId === c.id}
                            onClose={closeDropdown}
                            position={dropdownPosition}
                            onNavigate={navigateTo}
                          />
                        </div>
                      </div>

                      {/* Middle Area: Course Title & Description */}
                      <div className="space-y-1.5 mb-3">
                        <h4 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">
                          {c.title}
                        </h4>
                        {c.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {c.description}
                          </p>
                        )}
                        
                        {/* Badges for Quick Overview */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            {c.type}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {c.trainingMethod}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Effective
                          </span>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-slate-100 my-2.5" />

                      {/* Bottom Stats Grid (2-column layout for details) */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                        <div className="flex items-center text-slate-600">
                          <div>
                            <span className="text-2xs text-slate-400 block uppercase tracking-wider font-medium">Duration</span>
                            <span className="font-semibold text-slate-900">{c.duration}h</span>
                          </div>
                        </div>

                        <div className="flex items-center text-slate-600">
                          <div>
                            <span className="text-2xs text-slate-400 block uppercase tracking-wider font-medium">Pass Score</span>
                            <span className="font-semibold text-emerald-600">{c.passScore}%</span>
                          </div>
                        </div>

                        <div className="flex flex-col text-slate-600">
                          <span className="text-2xs text-slate-400 uppercase tracking-wider font-medium">Instructor</span>
                          <span className="font-semibold text-slate-700 truncate">{c.instructor}</span>
                        </div>

                        <div className="flex flex-col text-slate-600">
                          <span className="text-2xs text-slate-400 uppercase tracking-wider font-medium">Scheduled Date</span>
                          <span className="font-semibold text-slate-700">25/03/2026</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {courses.length > 0 && (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={courses.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            )}
          </div>
        </div>
      </div>
    </FormSection>
  );
};
