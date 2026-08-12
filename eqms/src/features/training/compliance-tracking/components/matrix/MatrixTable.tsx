import React from "react";
import { Search, AlertTriangle, PlusCircle, FilterX, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { Badge } from "@/components/ui";
import { useTableDragScroll } from "@/hooks";
import { ROUTES } from "@/app/routes.constants";
import type { MatrixFilters, EmployeeRow, SOPColumn } from "../../types";
import { MOCK_SOPS, getCell } from "../../mockData";
import { CELL_CONFIG } from "./constants";

interface MatrixTableProps {
  employees: EmployeeRow[];
  filters: MatrixFilters;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCellClick: (e: React.MouseEvent, employee: EmployeeRow, sop: SOPColumn) => void;
  onEmployeeClick: (e: React.MouseEvent, employee: EmployeeRow) => void;
  onSOPHeaderClick: (e: React.MouseEvent, sop: SOPColumn) => void;
  navigateTo?: (to: string | number, options?: any, delay?: number) => void;
}

export const MatrixTable: React.FC<MatrixTableProps> = React.memo(({
  employees,
  filters,
  hasActiveFilters,
  onClearFilters,
  onCellClick,
  onEmployeeClick,
  onSOPHeaderClick,
  navigateTo,
}) => {
  const [showScrollHint, setShowScrollHint] = React.useState(true);
  const { scrollerRef: scrollContainerRef, isDragging, dragEvents } = useTableDragScroll();

  React.useEffect(() => {
    const timer = setTimeout(() => setShowScrollHint(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* Mobile scroll controls */}
      <div className="relative">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 md:hidden">
          <button
            onClick={scrollLeft}
            className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-md border border-slate-200 hover:bg-white transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 md:hidden">
          <button
            onClick={scrollRight}
            className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-md border border-slate-200 hover:bg-white transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        {/* Scrollable grid - optimized for mobile */}
        <div
          ref={scrollContainerRef as any}
          className={cn(
            "overflow-x-auto overflow-y-auto max-h-[400px] sm:max-h-[500px] md:max-h-[580px] relative transition-all duration-300",
            "scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100",
            isDragging ? "cursor-grabbing select-none" : "cursor-grab"
          )}
          {...dragEvents}
        >
          {/* Scroll hint for mobile */}
          {showScrollHint && (
            <div className="absolute bottom-2 right-2 z-20 md:hidden bg-slate-800/80 backdrop-blur-sm text-white text-2xs px-2.5 py-1 rounded-full pointer-events-none animate-pulse flex items-center gap-1">
              Swipe to scroll
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </div>
          )}

          <table className="w-full border-separate border-spacing-0 text-sm md:text-base">
            <MatrixHead onSOPHeaderClick={onSOPHeaderClick} />
            <MatrixBody
              employees={employees}
              filters={filters}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={onClearFilters}
              onCellClick={onCellClick}
              onEmployeeClick={onEmployeeClick}
              navigateTo={navigateTo}
            />
          </table>
        </div>
      </div>

      {/* Summary bar - responsive */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-5 py-3 md:py-4 border-t border-slate-200/60 bg-white backdrop-blur-sm">
        <span className="text-2xs sm:text-xs text-slate-500 flex items-center gap-1.5 tabular-nums">
          <span className="font-semibold text-slate-700">{employees.length}</span> employees ×{" "}
          <span className="font-semibold text-slate-700">{MOCK_SOPS.length}</span> Courses
        </span>
      </div>
    </div>
  );
});

// ─── Head sub-component ───────────────────────────────────────────────────────
interface MatrixHeadProps {
  onSOPHeaderClick: (e: React.MouseEvent, sop: SOPColumn) => void;
}

const MatrixHead: React.FC<MatrixHeadProps> = React.memo(({ onSOPHeaderClick }) => (
  <thead>
    <tr>
      {/* No. column - smaller on mobile */}
      <th className="sticky top-0 left-0 z-30 bg-white border-b border-r border-slate-200/80 px-1.5 sm:px-2 py-2 sm:py-3 min-w-[36px] sm:min-w-[44px] max-w-[36px] sm:max-w-[44px] text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <span className="text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider">
          No.
        </span>
      </th>

      {/* Employee column - responsive width */}
      <th className="sticky top-0 left-[36px] sm:left-[44px] z-30 bg-white border-b border-r border-slate-200/80 px-2 sm:px-3 py-2 sm:py-3 min-w-[120px] sm:min-w-[140px] md:min-w-[180px] text-left shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <span className="text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider">
          Employee
        </span>
      </th>

      {/* SOP columns - responsive widths and fonts */}
      {MOCK_SOPS.map((sop) => (
        <th
          key={sop.id}
          className="sticky top-0 z-20 bg-white backdrop-blur-sm border-b border-r border-slate-200/80 px-1 sm:px-1.5 py-2 sm:py-3 min-w-[55px] sm:min-w-[70px] md:min-w-[90px] max-w-[80px] sm:max-w-[100px] md:max-w-[130px] cursor-pointer hover:bg-slate-100/90 transition-all duration-200 group/sop text-left shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          onClick={(e) => onSOPHeaderClick(e, sop)}
          title={`${sop.documentNumber}: ${sop.title}`}
        >
          <div className="flex flex-col gap-0.5 sm:gap-1">
            <span className="text-2xs sm:text-2xs md:text-xs font-bold text-emerald-600 tracking-tight truncate block max-w-full">
              {sop.documentNumber}
            </span>
            <span className="text-2xs sm:text-2xs md:text-2xs text-slate-500 font-medium truncate group-hover/sop:text-slate-700 transition-colors hidden sm:block max-w-full break-words">
              {sop.title}
            </span>
          </div>
        </th>
      ))}
    </tr>
  </thead>
));

// ─── Body sub-component ───────────────────────────────────────────────────────
interface MatrixBodyProps {
  employees: EmployeeRow[];
  filters: MatrixFilters;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCellClick: (e: React.MouseEvent, employee: EmployeeRow, sop: SOPColumn) => void;
  onEmployeeClick: (e: React.MouseEvent, employee: EmployeeRow) => void;
  navigateTo?: (path: any) => void;
}

const MatrixBody: React.FC<MatrixBodyProps> = React.memo(({
  employees,
  filters,
  hasActiveFilters,
  onClearFilters,
  onCellClick,
  onEmployeeClick,
  navigateTo,
}) => {
  if (employees.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={MOCK_SOPS.length + 2} className="py-16 sm:py-20 text-center">
            <div className="flex flex-col items-center gap-2 sm:gap-3">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-slate-100 flex items-center justify-center shadow-inner">
                <Search className="h-6 w-6 sm:h-7 sm:w-7 text-slate-400" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-slate-900">No matching employees</p>
              <p className="text-2xs sm:text-xs text-slate-500 max-w-[200px] sm:max-w-[240px] mx-auto">
                Try adjusting your filters
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearFilters}
                  className="mt-1 sm:mt-2 border-slate-200 hover:bg-slate-50 text-xs"
                >
                  Clear filters
                </Button>
              )}
            </div>
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody>
      {employees.map((emp, index) => (
        <tr key={emp.id} className="group/row transition-colors duration-150 hover:bg-slate-50/60">
          {/* No. */}
          <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-200/60 px-1.5 sm:px-2 py-1.5 sm:py-2 min-w-[36px] sm:min-w-[44px] max-w-[36px] sm:max-w-[44px] text-center group-hover/row:bg-slate-50">
            <span className="text-2xs sm:text-xs text-slate-500 font-medium">{index + 1}</span>
          </td>

          {/* Employee name - responsive with department hidden on very small screens */}
          <td
            className="sticky left-[36px] sm:left-[44px] z-10 bg-white border-b border-r border-slate-200/60 px-2 sm:px-3 py-1.5 sm:py-2 min-w-[120px] sm:min-w-[140px] md:min-w-[180px] cursor-pointer hover:bg-slate-50 transition-colors group-hover/row:bg-slate-50"
            onClick={(e) => onEmployeeClick(e, emp)}
            title={`View details for ${emp.fullName}`}
          >
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                {emp.fullName}
              </span>
              <span className="text-2xs text-slate-500 truncate hidden xs:block">
                {emp.department}
              </span>
            </div>
          </td>

          {/* Status cells - optimized for touch */}
          {MOCK_SOPS.map((sop) => {
            const cell = getCell(emp.id, sop.id);
            if (!cell) {
              return (
                <td
                  key={sop.id}
                  className="border-b border-r border-slate-200/60 p-0 min-w-[70px] sm:min-w-[85px] md:min-w-[120px]"
                />
              );
            }

            const cfg = CELL_CONFIG[cell.status];
            const isGapHidden = filters.gapAnalysis && cell.status === "Qualified";

            return (
              <td
                key={sop.id}
                className="border-b border-r border-slate-200/60 p-0 min-w-[70px] sm:min-w-[85px] md:min-w-[120px] h-px"
              >
                <button
                  className={cn(
                    "w-full h-full flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 transition-all duration-150 touch-manipulation group/cell min-h-[44px]",
                    isGapHidden
                      ? "bg-white text-slate-300 cursor-default"
                      : cn(
                        cfg.bg,
                        cfg.hoverBg,
                        "cursor-pointer active:scale-95 hover:scale-105"
                      ),
                    cell.status !== "NotRequired" && !isGapHidden && "shadow-sm"
                  )}
                  onClick={(e) => {
                    if (cell.status === "NotRequired") {
                      if (navigateTo) {
                        navigateTo(`${ROUTES.TRAINING.ASSIGNMENT_NEW}?employeeId=${emp.id}&courseId=${sop.id}`);
                      }
                    } else if (!isGapHidden) {
                      onCellClick(e, emp, sop);
                    }
                  }}
                  title={
                    isGapHidden
                      ? "Qualified (hidden)"
                      : cell.status === "NotRequired"
                        ? `Assign "${sop.title}" to ${emp.fullName}`
                        : `${cfg.label}: ${sop.title}`
                  }
                  aria-label={`${emp.fullName} - ${sop.documentNumber}: ${cfg.label}`}
                >
                  {isGapHidden ? (
                    <span className="text-slate-300 text-xs sm:text-sm font-medium">—</span>
                  ) : cell.status === "NotRequired" ? (
                    <>
                      <cfg.Icon
                        className={cn(
                          "h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 transition-all duration-200 group-hover/cell:opacity-0 group-hover/cell:scale-90",
                          cfg.iconColor
                        )}
                      />
                      <PlusCircle
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 absolute opacity-0 group-hover/cell:opacity-100 transition-all duration-200 group-hover/cell:scale-110"
                        aria-hidden
                      />
                    </>
                  ) : (
                    <>
                      <cfg.Icon
                        className={cn(
                          "h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0",
                          cfg.iconColor
                        )}
                      />
                      <span className="hidden sm:inline-block text-2xs font-medium select-none">
                        {cfg.label}
                      </span>
                    </>
                  )}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
});
