import React, { useState } from "react";
import {
  GraduationCap,
  ChevronRight,
  BellRing,
} from "lucide-react";
import {
  IconChecklist,
  IconAdjustmentsHorizontal,
  IconUsers,
} from "@tabler/icons-react";
import { FormSection } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { cn } from "@/components/ui/utils";
import { formatDate } from "@/utils/format";
import type { AssignmentPriority } from "../../../../types/assignment.types";
import { PRIORITY_COLORS } from "../../../../types/assignment.types";
import type { EmployeeRow } from "../../../types";
import { TYPE_BADGE_COLORS, type ApprovedCourse } from "../AssignTrainingView";

export interface Step4Props {
  course: ApprovedCourse | null;
  reasonForAssignment: string;
  targetSummary: string;
  resolvedAssignees: EmployeeRow[];
  priority: AssignmentPriority;
  deadlineDate: string;
  trainingBeforeAuthorized: boolean;
  requiresESign: boolean;
  isCrossTraining: boolean;
  reminders: number[];
  needsESign: boolean;
  onReasonChange: (v: string) => void;
}

export const Step4Review: React.FC<Step4Props> = ({
  course,
  reasonForAssignment,
  targetSummary,
  resolvedAssignees,
  priority,
  deadlineDate,
  trainingBeforeAuthorized,
  requiresESign,
  isCrossTraining,
  reminders,
  needsESign,
  onReasonChange,
}) => {
  const [showAllAssignees, setShowAllAssignees] = useState(false);
  const displayAssignees = showAllAssignees
    ? resolvedAssignees
    : resolvedAssignees.slice(0, 5);

  return (
    <FormSection
      title="Review Assignment"
      icon={<IconChecklist className="h-4 w-4" />}
    >
      <div className="space-y-6">
        {needsESign && (
          <div className="flex items-center justify-center text-center px-4 py-2 bg-amber-50/60 border border-amber-200/80 rounded-xl backdrop-blur-sm w-full">
            <p className="text-sm font-medium text-amber-800">
              <span className="font-semibold">E-Signature required</span> — You
              will be prompted to enter your credentials to authorize this
              assignment (Annex 11 / EU-GMP).
            </p>
          </div>
        )}

        {/* Row 1: Course Info, Assignment Config */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Course Information */}
          <FormSection
            title="Course Information"
            icon={<GraduationCap className="h-4 w-4" />}
            className="h-full"
          >
            <div className="space-y-4">
              {course ? (
                <div className="space-y-3.5">
                  {/* Course ID */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 pb-2.5 border-b border-slate-100/80">
                    <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Course ID</label>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 flex-1">
                      {course.trainingId}
                    </p>
                  </div>

                  {/* Course Name */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 pb-2.5 border-b border-slate-100/80">
                    <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Course Name</label>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 flex-1">
                      {course.title}
                    </p>
                  </div>

                  {/* Training Type */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 pb-2.5 border-b border-slate-100/80">
                    <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Training Type</label>
                    <div className="flex-1">
                      <Badge size="sm"
                        className={cn(
                          "text-2xs font-bold px-2 py-0.5 rounded-full border",
                          TYPE_BADGE_COLORS[course.type],
                        )}
                      >
                        {course.type}
                      </Badge>
                    </div>
                  </div>

                  {/* Training Method */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 pb-2.5 border-b border-slate-100/80">
                    <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Training Method</label>
                    <p className="text-xs sm:text-sm font-medium text-slate-700 flex-1">
                      {course.trainingMethod}
                    </p>
                  </div>

                  {/* Duration */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                    <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Duration</label>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 flex-1">
                      {course.duration}h
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-slate-400 text-sm">
                  No course selected
                </div>
              )}

              {/* Reason for Assignment Section removed: now handled in ESignatureModal */}
            </div>
          </FormSection>

          {/* Card 2: Assignment Configuration */}
          <FormSection
            title="Assignment Configuration"
            icon={<IconAdjustmentsHorizontal className="h-4 w-4" />}
            className="h-full"
          >
            <div className="space-y-4">
              {/* Row 1: Priority & Deadline */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 flex items-start gap-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">
                      Priority
                    </p>
                    <div className="mt-1">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold border",
                          PRIORITY_COLORS[priority],
                        )}
                      >
                        {priority}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 flex items-start gap-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">
                      Deadline
                    </p>
                    <p className="text-sm font-bold text-slate-900 mt-1">
                      {deadlineDate ? formatDate(deadlineDate) : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Row 2: Compliance with Checkboxes */}
              <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl space-y-3">
                <p className="text-2xs text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Compliance & Controls
                </p>

                {[
                  {
                    label: "Block tasks until completed",
                    val: trainingBeforeAuthorized,
                  },
                  {
                    label: "Require E-Signature on Completion",
                    val: requiresESign,
                  },
                  {
                    label: "Cross-training (Non-mandatory)",
                    val: isCrossTraining,
                  },
                ].map((item, i) => (
                  <Checkbox
                    key={i}
                    checked={item.val}
                    disabled
                    label={item.label}
                    className="py-1 select-none pointer-events-none"
                  />
                ))}
              </div>

              {/* Row 3: Reminders */}
              <div className="p-4 bg-emerald-50/20 border border-emerald-100/60 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white text-emerald-600 border border-emerald-100 flex-shrink-0">
                    <BellRing className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-2xs text-emerald-600 uppercase font-bold tracking-wider leading-none">
                      System Reminders
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {reminders.length > 0 ? (
                        reminders.map((d) => (
                          <span
                            key={d}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white border border-emerald-200 text-2xs font-bold text-emerald-700"
                          >
                            {d} days before
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          No reminders
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FormSection>

        </div>

        {/* Row 2: Target Assignees */}
        <FormSection
          title="Target Assignees"
          icon={<IconUsers className="h-4 w-4" />}
          headerRight={
            <Badge color="emerald" size="sm" className="font-medium">
              {resolvedAssignees.length} Employee{resolvedAssignees.length !== 1 ? "s" : ""}
            </Badge>
          }
        >
          {/* Scope Summary Line */}
          <div className="flex items-center gap-2 mb-3 bg-slate-50/60 p-2.5 rounded-lg border border-slate-200">
            <div className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
            <p className="text-xs font-medium text-slate-600">
              Scope: <span className="text-slate-900 font-semibold">{targetSummary}</span>
            </p>
          </div>

          {/* Scrollable List Area */}
          <div className="border border-slate-200 rounded-lg bg-slate-50/20 overflow-hidden">
            <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100/80 custom-scrollbar">
              {displayAssignees.map((e, index) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 p-3 hover:bg-emerald-50/50 transition-all group cursor-default"
                >
                  {/* 1. Số thứ tự (No.) */}
                  <span className="text-xs font-medium text-slate-400 w-5 flex-shrink-0 text-center">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  {/* 3. Employee Info */}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate text-sm">
                      {e.fullName}
                    </p>
                    <div className="text-2xs text-slate-500 truncate mt-0.5 font-medium">
                      <span className="text-emerald-600 font-medium mr-1.5">{e.employeeCode}</span>
                      • {e.position} • {e.department}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Toggle Button */}
          {resolvedAssignees.length > 5 && (
            <div className="mt-5 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllAssignees((v) => !v)}
              >
                {showAllAssignees ? (
                  <>
                    Show less <ChevronRight className="h-3.5 w-3.5 ml-1.5 rotate-90 transition-transform" />
                  </>
                ) : (
                  <>
                    Show more
                    <ChevronRight className="h-3.5 w-3.5 ml-1.5 transition-transform" />
                  </>
                )}
              </Button>
            </div>
          )}
        </FormSection>
      </div>
    </FormSection>
  );
};
