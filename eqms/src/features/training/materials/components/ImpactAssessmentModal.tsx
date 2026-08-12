import React, { useState, useEffect } from "react";
import {
  GitBranch,
  Users,
  BookOpen,
  Info,
} from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { InlineLoading } from "@/components/ui/loading/Loading";
import { Badge } from "@/components/ui/badge/Badge";
import { cn } from "@/components/ui/utils";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { ROUTES } from "@/app/routes.constants";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";

// ─── Types ───────────────────────────────────────────────────────────
export interface ImpactMaterial {
  id: string;
  materialNumber: string;
  title: string;
  version: string;
  type: string;
}

export interface ImpactLinkedCourse {
  courseId: string;
  courseName: string;
  employeeCount: number;
}

export interface ImpactAssessmentModalProps {
  isOpen: boolean;
  material: ImpactMaterial | null;
  linkedCourses: ImpactLinkedCourse[];
  onClose: () => void;
  /** Called when the user confirms the action */
  onConfirm: () => void;
}

// ─── Component ───────────────────────────────────────────────────────
export const ImpactAssessmentModal: React.FC<ImpactAssessmentModalProps> = ({
  isOpen,
  material,
  linkedCourses,
  onClose,
  onConfirm,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { scrollerRef, dragEvents } = useTableDragScroll();

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const totalEmployees = linkedCourses.reduce((sum, c) => sum + c.employeeCount, 0);

  const nextVersion = material
    ? `${parseInt(material.version, 10) + 1}.0`
    : "";

  const handleConfirm = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onConfirm();
    }, 600);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Impact Assessment"
      size="xl"
      showFooter
      cancelText="Cancel"
      confirmText={
        isSubmitting ? (
          <InlineLoading size="xs" color="white" />
        ) : (
          "Proceed to Upgrade"
        )
      }
      confirmDisabled={isSubmitting}
      onConfirm={handleConfirm}
      confirmVariant="default"
    >
      <div className="space-y-5">
        {/* ── Version upgrade indicator ── */}
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <GitBranch className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900">
              Material Revision Upgrade
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-blue-700">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200">
                {material?.version}
              </span>
              <span className="text-blue-400">→</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 border border-amber-200">
                {nextVersion}
              </span>
              <span className="text-blue-600 ml-1">{material?.materialNumber}</span>
            </div>
          </div>
        </div>

        {/* ── Affected Courses table ── */}
        <div>
          <p className="text-xs sm:text-sm font-semibold text-slate-900 flex items-center gap-2 mb-2">
            Affected Courses
            <Badge size="sm" color="slate" variant="soft" className="ml-auto">
              {linkedCourses.length} course{linkedCourses.length !== 1 ? "s" : ""}
            </Badge>
          </p>

          {linkedCourses.length === 0 ? (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <Info className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800 font-medium">
                No courses are currently using this material.
              </p>
            </div>
          ) : (
            <div
              ref={scrollerRef}
              {...dragEvents}
              className="border border-slate-200 rounded-xl overflow-x-auto select-none cursor-grab active:cursor-grabbing"
            >
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider text-2xs md:text-xs whitespace-nowrap">
                      No.
                    </th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider text-2xs md:text-xs whitespace-nowrap">
                      Course ID
                    </th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider text-2xs md:text-xs whitespace-nowrap">
                      Course Name
                    </th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider text-2xs md:text-xs whitespace-nowrap">
                      Employees
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linkedCourses.map((course, index) => (
                    <tr
                      key={course.courseId}
                      className="bg-white hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-slate-500 font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-emerald-600 hover:underline whitespace-nowrap">
                        <a
                          href={ROUTES.TRAINING.COURSE_DETAIL(course.courseId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {course.courseId}
                        </a>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                        {course.courseName}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                          {course.employeeCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Employee retraining stat ── */}
        {totalEmployees > 0 && (
          <WarningBanner
            variant="warning"
            description={
              <p>
                This action will require{" "}
                <span className="font-bold">{totalEmployees} employees</span> to
                complete retraining once the new revision becomes Effective.
              </p>
            }
          />
        )}
      </div>
    </FormModal>
  );
};
