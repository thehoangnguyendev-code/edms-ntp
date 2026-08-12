import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  History,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Calendar,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { cn } from "@/components/ui/utils";
import type { EmployeeTrainingFile, CompletedCourseRecord } from "../../types";
import { motion, AnimatePresence } from "framer-motion";

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return isMobile;
};

// ─── History Node ─────────────────────────────────────────────────────────────
interface HistoryNodeProps {
  course: CompletedCourseRecord;
  isLatest: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

const HistoryNode: React.FC<HistoryNodeProps> = ({
  course,
  isLatest,
  isExpanded,
  onToggle
}) => {
  return (
    <div className={cn(
      "border transition-all duration-300 rounded-xl overflow-hidden bg-white",
      isExpanded ? "border-emerald-200" : "border-slate-200 hover:border-slate-300"
    )}>
      {/* Node Header */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full text-left px-3 sm:px-4 pt-3 pb-2.5 flex items-center justify-between transition-colors relative z-10",
          isExpanded ? "bg-emerald-50/20" : "bg-slate-50/30 hover:bg-slate-100/50"
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 min-w-0 flex-1 mr-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-900 text-white text-2xs sm:text-xs font-medium tracking-wide">
              {course.version}
            </span>
            <Badge color={course.status === "Pass" ? "emerald" : "red"} size="xs" className="sm:hidden">
              {course.status === "Pass" ? "PASSED" : "FAILED"}
            </Badge>
            <Badge color={course.status === "Pass" ? "emerald" : "red"} size="sm" className="hidden sm:inline-flex">
              {course.status === "Pass" ? "PASSED" : "FAILED"}
            </Badge>
            {isLatest && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-2xs sm:text-xs font-medium">
                Active
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-700 sm:text-slate-600 truncate max-w-full sm:max-w-[180px]">
            {course.courseCode}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-emerald-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 16 }}
            className="overflow-hidden"
          >
            <div className="p-4 sm:p-5 border-t border-slate-100 space-y-6 sm:space-y-8">
              {/* Training Outcome Section - Flat Integrated Style */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-900 tracking-tight">Training Outcome</h3>
                  <Badge color={course.score >= course.passingScore ? "emerald" : "red"} size="xs">Grade: {course.score}%</Badge>
                </div>
                <div className="h-px bg-slate-100 w-full" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-1">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-2xs font-medium text-slate-500 sm:text-slate-700">Passing Requirement</p>
                      <p className="text-xs sm:text-sm font-bold sm:font-semibold text-slate-900">{course.passingScore}% or higher</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <Calendar className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-2xs font-medium text-slate-500 sm:text-slate-700">Record Validity</p>
                      <p className="text-xs sm:text-sm font-bold sm:font-semibold text-slate-900 uppercase">{course.expiryDate || "NEVER EXPIRES"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compliance Verification Section */}
              <div className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
                <div className="h-px bg-slate-100 w-full" />
                <div className="divide-y divide-slate-100">
                  {[
                    { label: "E-Signed By (Trainee)", value: course.traineeName },
                    { label: "Trainee Signature Timestamp", value: course.traineeEsignDate },
                    { label: "Verified By (Trainer)", value: course.trainerName },
                    { label: "Trainer Verification Timestamp", value: course.trainerEsignDate },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2 sm:py-2.5">
                      <span className="sm:w-[180px] shrink-0 text-2xs sm:text-xs text-slate-500 sm:text-slate-600 font-normal">{label}</span>
                      <span className="text-xs font-medium sm:font-normal text-slate-900 break-all sm:break-normal">{value || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Drawer ──────────────────────────────────────────────────────────────
export interface LearningHistoryDrawerProps {
  isOpen?: boolean;
  employee: EmployeeTrainingFile | null;
  onClose: () => void;
}

export const LearningHistoryDrawer: React.FC<LearningHistoryDrawerProps> = ({
  isOpen,
  employee,
  onClose
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const isMobile = useIsMobile();

  const history = employee?.completedCourses ?? [];

  // Sort by date (descending)
  const sorted = useMemo(() => [...history].sort((a, b) =>
    new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime()
  ), [history]);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Update expandedNodes when sorted changes and drawer opens
  useEffect(() => {
    if (isOpen && employee && sorted.length > 0 && expandedNodes.size === 0) {
      setExpandedNodes(new Set([sorted[0].id]));
    }
  }, [isOpen, employee, sorted]);

  // Dragging / Bottom Sheet State
  const [drawerHeight, setDrawerHeight] = useState(88); // vh
  const [isDragging, setIsDragging] = useState(false);

  // Early return logic moved below hooks

  const isAllExpanded = expandedNodes.size === sorted.length && sorted.length > 0;

  const toggleAll = () => {
    if (isAllExpanded) {
      setExpandedNodes(new Set());
    } else {
      setExpandedNodes(new Set(sorted.map(s => s.id)));
    }
  };

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const dragStartY = React.useRef(0);
  const dragStartHeight = React.useRef(88);

  const MAX_HEIGHT = 100;
  const CLOSE_THRESHOLD = 25;

  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartHeight.current = drawerHeight;
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const viewportHeight = window.innerHeight;
    const deltaY = dragStartY.current - clientY;
    const deltaVh = (deltaY / viewportHeight) * 100;

    let newHeight = dragStartHeight.current + deltaVh;
    newHeight = Math.max(0, Math.min(MAX_HEIGHT, newHeight));
    setDrawerHeight(newHeight);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (drawerHeight < CLOSE_THRESHOLD) {
      handleClose();
    } else {
      setDrawerHeight(88); // Snap back to 88
    }
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => handleDragMove(e.clientY);
    const onEnd = () => handleDragEnd();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
    };
  }, [isDragging, drawerHeight]);

  const handleTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientY);
  const handleTouchEnd = () => handleDragEnd();

  const isFullHeight = drawerHeight >= 98;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!isOpen || !employee) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center md:justify-end">
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        @keyframes slideInBottom { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideOutBottom { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        .desktop-drawer-enter { animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .desktop-drawer-exit { animation: slideOutRight 0.25s cubic-bezier(0.4, 0, 1, 1) forwards; }
        .mobile-drawer-enter { animation: slideInBottom 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .mobile-drawer-exit { animation: slideOutBottom 0.3s cubic-bezier(0.4, 0, 1, 1) forwards; }
        .backdrop-enter { animation: fadeIn 0.3s ease-out forwards; }
        .backdrop-exit { animation: fadeOut 0.25s ease-in forwards; }
        .custom-drawer-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(203, 213, 225, 0.4) transparent;
          scrollbar-gutter: stable;
        }
        .custom-drawer-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-drawer-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-drawer-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(203, 213, 225, 0.4);
          border-radius: 10px;
        }
        .custom-drawer-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.6);
        }
        @keyframes marker-pulse-emerald {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
          70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes marker-pulse-slate {
          0% { box-shadow: 0 0 0 0 rgba(15, 23, 42, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(15, 23, 42, 0); }
          100% { box-shadow: 0 0 0 0 rgba(15, 23, 42, 0); }
        }
        .animate-pulse-emerald {
          animation: marker-pulse-emerald 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-pulse-slate {
          animation: marker-pulse-slate 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto",
          isClosing ? "backdrop-exit" : "backdrop-enter"
        )}
        onClick={handleClose}
      />

      {/* Drawer Panel */}
      <div
        className={cn(
          "pointer-events-auto bg-white flex flex-col relative overflow-hidden",
          isMobile
            ? cn("w-full transition-all flex flex-col", isFullHeight ? "rounded-none" : "rounded-t-xl")
            : "w-[500px] h-[calc(100vh-32px)] mr-4 rounded-xl border border-slate-200",
          isClosing
            ? (isMobile ? "mobile-drawer-exit" : "desktop-drawer-exit")
            : (isMobile ? (!isDragging && "mobile-drawer-enter") : "desktop-drawer-enter")
        )}
        style={isMobile ? {
          height: `${drawerHeight}dvh`,
          transition: isDragging ? 'none' : 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), height 400ms cubic-bezier(0.16, 1, 0.3, 1), border-radius 200ms ease',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingTop: isFullHeight ? 'env(safe-area-inset-top, 0px)' : '0px',
        } : {}}
      >
        {/* Mobile Drag Handle */}
        {isMobile && (
          <div
            className="flex flex-col items-center py-3 cursor-grab active:cursor-grabbing select-none touch-none bg-white shrink-0"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={(e) => handleDragStart(e.clientY)}
          >
            <div className={cn(
              "rounded-full transition-all duration-200",
              isDragging ? "w-20 h-1.5 bg-slate-400" : "w-12 h-1 bg-slate-200 hover:bg-slate-300"
            )} />
          </div>
        )}

        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <History className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs text-slate-400 font-medium">Learning History</p>
              <p className="text-xs md:text-sm font-bold text-slate-900 truncate">{employee.employeeName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-2">
            <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 text-slate-600 text-2xs sm:text-xs font-medium border border-slate-200">
              {employee.employeeId}
            </span>
            <button
              onClick={handleClose}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto p-4 md:p-5 pb-4 pt-0 space-y-4 bg-slate-50/30 custom-drawer-scrollbar"
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain"
          }}
        >
          {sorted.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl py-10 text-center px-4 flex flex-col items-center">
              <History className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-sm font-bold text-slate-700">No training history found</p>
              <p className="text-xs text-slate-400 mt-1">This employee has not completed any courses yet.</p>
            </div>
          ) : (
            <div className="relative pl-7 sm:pl-8 pr-1 pt-0 pb-4 space-y-6">
              {/* Vertical Timeline Line */}
              <div className="absolute left-3.5 sm:left-4 top-0 bottom-6 w-px bg-slate-200" />

              {sorted.map((course, idx) => (
                <div key={course.id} className="relative">
                  {/* Timeline Marker */}
                  <div className={cn(
                    "absolute -left-[22px] sm:-left-6 top-[12px] sm:top-[14px] w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 sm:border-[3px] border-white z-10 transition-all duration-300",
                    expandedNodes.has(course.id)
                      ? (idx === 0
                        ? "bg-emerald-700 ring-4 ring-emerald-100 animate-pulse-emerald"
                        : "bg-emerald-500 ring-4 ring-emerald-50 animate-pulse-emerald")
                      : (idx === 0 ? "bg-emerald-600 ring-4 ring-emerald-50" : "bg-slate-300 ring-4 ring-slate-50")
                  )} />

                  <HistoryNode
                    course={course}
                    isLatest={idx === 0}
                    isExpanded={expandedNodes.has(course.id)}
                    onToggle={() => toggleNode(course.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-5 border-t border-slate-200 bg-white shrink-0 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-400 tracking-tight">
            {sorted.length} Record{sorted.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {sorted.length > 0 && (
              <>
                <Button
                  variant="outline-emerald"
                  size="xs"
                  className="sm:hidden"
                  onClick={toggleAll}
                >
                  {isAllExpanded ? (
                    <>
                      <Minimize2 className="h-3 w-3 mr-1" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3 w-3 mr-1" />
                      Expand
                    </>
                  )}
                </Button>
                <Button
                  variant="outline-emerald"
                  size="sm"
                  className="hidden sm:flex"
                  onClick={toggleAll}
                >
                  {isAllExpanded ? (
                    <>
                      <Minimize2 className="h-3 w-3 mr-2" />
                      Collapse All
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3 w-3 mr-2" />
                      Expand All
                    </>
                  )}
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={handleClose} className="text-xs sm:text-sm">Close</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
