import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";

import { Select } from "@/components/ui/select/Select";
import { FormModal } from "@/components/ui/modal/FormModal";
import { cn } from "@/components/ui/utils";
import { InlineLoading } from "@/components/ui/loading/Loading";
import { IconBook, IconCheck } from "@tabler/icons-react";
import { StatusType, StatusBadge } from "@/components/ui/badge/Badge";
import { ESignatureModal } from "@/components/ui/esign-modal";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";

// ─── Types ───────────────────────────────────────────────────────────
export interface ObsoleteMaterial {
  id: string;
  materialNumber: string;
  title: string;
  version: string;
  type: string;
  linkedCourses: string[];
}

export interface ObsoleteResult {
  justificationCode: string;
  justificationNote: string;
  replacedByCode: string; // empty if N/A
}

export interface MarkObsoleteModalProps {
  isOpen: boolean;
  material: ObsoleteMaterial | null;
  onClose: () => void;
  onConfirm: (result: ObsoleteResult) => void;
}

// ─── Mock linked course details ───────────────────────────────────────
type CourseStatus = "Active" | "In Progress" | "Completed" | "Cancelled";

interface LinkedCourseDetail {
  courseId: string;
  title: string;
  department: string;
  status: CourseStatus;
  learnersEnrolled: number;
}

const MOCK_COURSE_DETAILS: Record<string, LinkedCourseDetail> = {
  "TRN-2026-001": { courseId: "TRN-2026-001", title: "New Employee GMP Onboarding", department: "Quality Assurance", status: "Completed", learnersEnrolled: 24 },
  "TRN-2026-002": { courseId: "TRN-2026-002", title: "Cleanroom Certification - Level 1", department: "Production", status: "In Progress", learnersEnrolled: 18 },
  "TRN-2026-003": { courseId: "TRN-2026-003", title: "Engineering Equipment Safety", department: "Engineering", status: "In Progress", learnersEnrolled: 22 },
  "TRN-2026-004": { courseId: "TRN-2026-004", title: "Annual GMP Refresher Q1", department: "Production", status: "Active", learnersEnrolled: 38 },
  "TRN-2026-005": { courseId: "TRN-2026-005", title: "Sterile Manufacturing Basics", department: "Production", status: "Active", learnersEnrolled: 25 },
  "TRN-2026-006": { courseId: "TRN-2026-006", title: "ISO 9001 Internal Auditor Training", department: "Quality Assurance", status: "Active", learnersEnrolled: 16 },
  "TRN-2026-007": { courseId: "TRN-2026-007", title: "Site-wide Safety Awareness 2026", department: "HSE", status: "Completed", learnersEnrolled: 120 },
  "TRN-2026-008": { courseId: "TRN-2026-008", title: "QA Team Competency Training", department: "Quality Assurance", status: "Completed", learnersEnrolled: 12 },
  "TRN-2026-009": { courseId: "TRN-2026-009", title: "Emergency Response Procedures", department: "HSE", status: "In Progress", learnersEnrolled: 45 },
  "TRN-2026-010": { courseId: "TRN-2026-010", title: "SOP Documentation Workshop", department: "Quality Control", status: "Active", learnersEnrolled: 20 },
  "TRN-2026-011": { courseId: "TRN-2026-011", title: "Chemical Safety for Lab Teams", department: "HSE", status: "In Progress", learnersEnrolled: 18 },
  "TRN-2026-012": { courseId: "TRN-2026-012", title: "Chemical Safety Training 2026", department: "HSE", status: "Active", learnersEnrolled: 30 },
  "TRN-2026-013": { courseId: "TRN-2026-013", title: "Hazardous Materials Handling", department: "HSE", status: "Completed", learnersEnrolled: 20 },
  "TRN-2026-014": { courseId: "TRN-2026-014", title: "HPLC Operations Training", department: "Quality Control", status: "Active", learnersEnrolled: 10 },
  "TRN-2026-015": { courseId: "TRN-2026-015", title: "Water System Qualification Training", department: "Engineering", status: "Active", learnersEnrolled: 8 },
};

const ACTIVE_STATUSES: CourseStatus[] = ["Active", "In Progress"];

const JUSTIFICATION_OPTIONS = [
  { value: "replaced_new_version", label: "Replaced by a newer version" },
  { value: "equipment_decommissioned", label: "Equipment has been decommissioned / retired" },
  { value: "process_no_longer_applicable", label: "Process / procedure no longer applicable" },
  { value: "regulatory_change", label: "Superseded by regulatory / policy change" },
  { value: "content_inaccurate", label: "Content found to be inaccurate or outdated" },
  { value: "other", label: "Other reason" },
];

const getCourseStatusConfig = (status: CourseStatus): { status: StatusType } => {
  const statusMap: Record<CourseStatus, StatusType> = {
    "Active": "active",
    "In Progress": "inProgress",
    "Completed": "completed",
    "Cancelled": "cancelled",
  };
  return {
    status: statusMap[status] || 'draft'
  };
};

const STEPS = [
  { label: "Impact Analysis", short: "Impact" },
  { label: "Justification", short: "Reason" },
];

export const MarkObsoleteModal: React.FC<MarkObsoleteModalProps> = ({
  isOpen,
  material,
  onClose,
  onConfirm,
}) => {
  const [step, setStep] = useState(0);

  const [justificationCode, setJustificationCode] = useState("");
  const [justificationNote, setJustificationNote] = useState("");
  const [replacedByCode, setReplacedByCode] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showESign, setShowESign] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setJustificationCode("");
      setJustificationNote("");
      setReplacedByCode("");
      setIsSubmitting(false);
      setShowESign(false);
    }
  }, [isOpen]);

  const linkedDetails: LinkedCourseDetail[] = (material?.linkedCourses || [])
    .map((id) => MOCK_COURSE_DETAILS[id])
    .filter(Boolean);

  const activeCourses = linkedDetails.filter((c) => ACTIVE_STATUSES.includes(c.status));
  const completedCourses = linkedDetails.filter((c) => !ACTIVE_STATUSES.includes(c.status));
  const totalAffectedLearners = activeCourses.reduce((s, c) => s + c.learnersEnrolled, 0);
  const hasActiveCourses = activeCourses.length > 0;
  const isReplacedByVersion = justificationCode === "replaced_new_version";

  const step2Valid =
    !!justificationCode &&
    (justificationCode !== "other" || justificationNote.trim().length > 0);

  const handleESign = () => {
    setShowESign(true);
  };

  const handleESignConfirm = async (_reason: string) => {
    setIsSubmitting(true);
    try {
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
      onConfirm({
        justificationCode,
        justificationNote,
        replacedByCode: "",
      });
      setShowESign(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Mark as Obsolete"
        description={material ? `${material.materialNumber} · ${material.title} · Version ${material.version}` : undefined}
        size="lg"
        showFooter={true}
        showCancel={step === 0}
        cancelText="Cancel"
        confirmText={isSubmitting ? <InlineLoading size="xs" color="white" /> : (step === 1 ? "Confirm & Sign" : "Continue")}
        confirmDisabled={(step === 1 && !step2Valid) || isSubmitting}
        onConfirm={step < 1 ? () => setStep(s => s + 1) : handleESign}
        confirmVariant={step === 1 || (step === 0 && hasActiveCourses) ? "destructive" : "default"}
        footerLeft={
          step === 1 ? (
            <div className="flex justify-end mr-2 sm:mr-3">
              <Button size="sm" variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-6">
          {/* Indicator */}
          <div className="flex items-center justify-center gap-0 px-2 py-1 border-b border-slate-100 bg-slate-50/50 -mx-4 sm:-mx-6 mb-5 shrink-0">
            {STEPS.map((s, i) => {
              const isDone = i < step;
              const isCurrent = i === step;
              return (
                <React.Fragment key={s.label}>
                  <div className="flex flex-col items-center gap-2 py-3">
                    <div className={cn(
                      "relative w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold transition-all",
                      isDone ? "bg-emerald-600 text-white" :
                        isCurrent ? "bg-red-600 text-white ring-4 ring-red-100" :
                          "bg-slate-100 text-slate-400 border border-slate-200"
                    )}>
                      {isDone ? <IconCheck className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={cn(
                      "text-2xs font-semibold text-center leading-tight transition-colors",
                      isCurrent ? "text-red-700" : isDone ? "text-emerald-700" : "text-slate-400"
                    )}>
                      {s.short}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn(
                      "flex-1 mx-1 sm:mx-2 h-0.5 transition-all max-w-[30px] sm:max-w-[40px] self-start mt-7 rounded-full",
                      isDone ? "bg-emerald-500" : "bg-slate-200"
                    )} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  Impact Analysis
                </h3>
              </div>

              {hasActiveCourses && (
                <WarningBanner
                  variant="error"
                  title={`${activeCourses.length} active course${activeCourses.length > 1 ? "s" : ""} will be affected`}
                  description={`This material is used in ${activeCourses.length} active courses with ${totalAffectedLearners} learners. Marking as obsolete will disrupt these courses.`}
                />
              )}

              {!linkedDetails.length && (
                <div className="flex items-start gap-3 p-4 md:p-5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-emerald-800 italic">No active courses affected. Safe to proceed.</p>
                </div>
              )}

              {activeCourses.length > 0 && (
                <div className="space-y-2">
                  <p className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Active Courses</p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {activeCourses.map((c) => {
                      const cfg = getCourseStatusConfig(c.status);
                      return (
                        <div key={c.courseId} className="flex items-center gap-3 px-4 py-3 bg-white">
                          <IconBook className="h-4 w-4 text-slate-400" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs md:text-sm font-medium text-slate-900 truncate">{c.title}</p>
                            <p className="text-2xs text-slate-500 mt-0.5">{c.courseId} · {c.department}</p>
                          </div>
                          <StatusBadge status={cfg.status} size="sm" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Justification
                </h3>
              </div>

              <div className="space-y-4">
                <Select
                  label={<>Reason <span className="text-red-500">*</span></>}
                  value={justificationCode}
                  onChange={(val) => {
                    setJustificationCode(val);
                    if (val !== "replaced_new_version") setReplacedByCode("");
                    if (val !== "other") setJustificationNote("");
                  }}
                  options={JUSTIFICATION_OPTIONS}
                  placeholder="Choose a reason..."
                />



                {justificationCode === "other" && (
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-medium text-slate-700">Notes <span className="text-red-500">*</span></label>
                    <textarea
                      value={justificationNote}
                      onChange={(e) => setJustificationNote(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm resize-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </FormModal>
      <ESignatureModal
        isOpen={showESign}
        onClose={() => setShowESign(false)}
        onConfirm={(data) => handleESignConfirm(data.reason)}
        actionTitle="Obsolete Material"
      />
    </>
  );
};
