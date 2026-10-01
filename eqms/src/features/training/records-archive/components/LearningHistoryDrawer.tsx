import { Drawer, type DrawerHandle } from "@/components/ui/drawer";
import React, { useState, useEffect, useMemo } from "react";
import { History, ShieldCheck, ChevronDown, ChevronUp, Calendar, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { cn } from "@/components/ui/utils";
import type { EmployeeTrainingFile, CompletedCourseRecord } from "../../types";
import { motion, AnimatePresence } from "framer-motion";

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
  const drawer = React.useRef<DrawerHandle>(null);
  const handleClose = () => drawer.current?.close();


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

  if (!employee) return null;


  return <Drawer
    ref={drawer}
    onClose={onClose}
    open={Boolean(isOpen)}
    title={employee.employeeName}
    subtitle="Learning History"
    icon={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50"><History className="h-4 w-4 text-emerald-600" /></span>}
    headerActions={<Badge color="emerald" size="sm">{employee.employeeId}</Badge>}
    footerClassName="justify-between"
    bodyClassName="space-y-4"
    footer={<>
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
    </>}
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

  </Drawer>;
};
