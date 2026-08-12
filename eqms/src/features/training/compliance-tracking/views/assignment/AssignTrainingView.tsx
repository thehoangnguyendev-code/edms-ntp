import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  GraduationCap,
  Building2,
} from "lucide-react";
import {
  IconAdjustmentsHorizontal,
  IconBuilding,
  IconCheck,
  IconChecklist,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { ROUTES } from "@/app/routes.constants";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { AlertModal } from "@/components/ui/modal";
import { FullPageLoading } from "@/components/ui/loading";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { useNavigateWithLoading } from "@/hooks";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import breadcrumbs from "@/components/ui/breadcrumb/breadcrumbs.config";
import {
  PRIORITY_DEADLINE_DAYS,
  type AssignmentPriority,
  type AssignmentScope,
} from "../../../types/assignment.types";
import { complianceTrackingRepository } from "../../repository";
import type { EmployeeRow } from "../../types";

import { Step1CourseSelect } from "./components/Step1CourseSelect";
import { Step2Assignees } from "./components/Step2Assignees";
import { Step3Config } from "./components/Step3Config";
import { Step4Review } from "./components/Step4Review";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ApprovedCourse {
  id: string;
  trainingId: string;
  title: string;
  description?: string;
  type: string;
  trainingMethod: string;
  duration: number;
  passScore: number;
  mandatory: boolean;
  linkedDocumentTitle?: string;
  instructor: string;
}

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS = [
  "Select Course",
  "Select Assignees",
  "Configure",
  "Review & Submit",
];
const STEP_ICONS = [
  GraduationCap,
  IconUsers,
  IconAdjustmentsHorizontal,
  IconChecklist,
];

// ─── Approved courses (filter from mock) ─────────────────────────────────────
export const APPROVED_COURSES: ApprovedCourse[] = [
  {
    id: "1",
    trainingId: "TRN-2026-001",
    title: "GMP Basic Training",
    description: "Introduction to Good Manufacturing Practices (GMP) and fundamental compliance principles.",
    type: "GMP",
    trainingMethod: "Quiz (Paper-based/Manual)",
    duration: 4,
    passScore: 80,
    mandatory: true,
    linkedDocumentTitle: "TM-VID-001",
    instructor: "Dr. Sarah Williams",
  },
  {
    id: "2",
    trainingId: "TRN-2026-002",
    title: "Cleanroom Operations",
    description: "Procedures and guidelines for operating safely within a certified cleanroom environment.",
    type: "Technical",
    trainingMethod: "Hands-on/OJT",
    duration: 8,
    passScore: 75,
    mandatory: true,
    linkedDocumentTitle: "TM-PDF-002",
    instructor: "Jennifer Lee",
  },
  {
    id: "3",
    trainingId: "TRN-2026-003",
    title: "Workplace Safety & HSE",
    description: "General safety protocols, emergency responses, and hazard management.",
    type: "Safety",
    trainingMethod: "Read & Understood",
    duration: 2,
    passScore: 80,
    mandatory: true,
    linkedDocumentTitle: "TM-PDF-003",
    instructor: "Chris Anderson",
  },
  {
    id: "4",
    trainingId: "TRN-2026-004",
    title: "ISO 9001 Internal Auditor",
    type: "Compliance",
    trainingMethod: "Quiz (Paper-based/Manual)",
    duration: 16,
    passScore: 70,
    mandatory: false,
    linkedDocumentTitle: "TM-IMG-004",
    instructor: "External Trainer",
  },
  {
    id: "5",
    trainingId: "TRN-2026-005",
    title: "SOP Documentation & Control",
    type: "GMP",
    trainingMethod: "Read & Understood",
    duration: 4,
    passScore: 80,
    mandatory: true,
    linkedDocumentTitle: "TM-VID-005",
    instructor: "Maria Lopez",
  },
  {
    id: "6",
    trainingId: "TRN-2026-006",
    title: "HPLC Operations",
    type: "Technical",
    trainingMethod: "Hands-on/OJT",
    duration: 8,
    passScore: 80,
    mandatory: true,
    linkedDocumentTitle: "TM-DOC-006",
    instructor: "Robert Johnson",
  },
  {
    id: "7",
    trainingId: "TRN-2026-007",
    title: "Validation IQ/OQ/PQ",
    type: "Technical",
    trainingMethod: "Quiz (Paper-based/Manual)",
    duration: 4,
    passScore: 75,
    mandatory: false,
    linkedDocumentTitle: "TM-PDF-007",
    instructor: "Dr. Anna Smith",
  },
  {
    id: "8",
    trainingId: "TRN-2026-008",
    title: "Risk Assessment & FMEA",
    type: "Compliance",
    trainingMethod: "Read & Understood",
    duration: 3,
    passScore: 80,
    mandatory: true,
    linkedDocumentTitle: "TM-DOC-008",
    instructor: "Dr. Anna Smith",
  },
  {
    id: "9",
    trainingId: "TRN-2026-009",
    title: "Chemical Safety",
    type: "Safety",
    trainingMethod: "Read & Understood",
    duration: 2,
    passScore: 80,
    mandatory: true,
    linkedDocumentTitle: "TM-VID-009",
    instructor: "HSE Dept.",
  },
  {
    id: "10",
    trainingId: "TRN-2026-010",
    title: "Data Integrity (ALCOA+)",
    type: "Compliance",
    trainingMethod: "Quiz (Paper-based/Manual)",
    duration: 4,
    passScore: 90,
    mandatory: true,
    linkedDocumentTitle: "TM-PDF-010",
    instructor: "QA Dept.",
  },
  {
    id: "11",
    trainingId: "TRN-2026-011",
    title: "Deviation & CAPA",
    type: "GMP",
    trainingMethod: "Read & Understood",
    duration: 4,
    passScore: 85,
    mandatory: true,
    linkedDocumentTitle: "TM-DOC-011",
    instructor: "QA Dept.",
  },
  {
    id: "12",
    trainingId: "TRN-2026-012",
    title: "Change Control Process",
    type: "GMP",
    trainingMethod: "Read & Understood",
    duration: 4,
    passScore: 80,
    mandatory: true,
    linkedDocumentTitle: "TM-PDF-012",
    instructor: "QA Dept.",
  },
  {
    id: "13",
    trainingId: "SOP-013",
    title: "Sampling Procedures",
    type: "Technical",
    trainingMethod: "Hands-on/OJT",
    duration: 2,
    passScore: 80,
    mandatory: true,
    linkedDocumentTitle: "TM-PDF-013",
    instructor: "QC Dept.",
  },
  {
    id: "14",
    trainingId: "SOP-014",
    title: "Equipment Calibration",
    type: "Technical",
    trainingMethod: "Hands-on/OJT",
    duration: 4,
    passScore: 80,
    mandatory: true,
    linkedDocumentTitle: "TM-DOC-014",
    instructor: "Engineering Dept.",
  },
  {
    id: "15",
    trainingId: "SOP-015",
    title: "Batch Record Review",
    type: "GMP",
    trainingMethod: "Read & Understood",
    duration: 6,
    passScore: 85,
    mandatory: true,
    linkedDocumentTitle: "TM-PDF-015",
    instructor: "QA Dept.",
  },
];

export const BUSINESS_UNITS = ["Quality Unit", "Operation Unit", "Support Unit"];
export const DEPARTMENTS = [
  "Quality Assurance",
  "Quality Control",
  "Production",
  "Engineering",
  "Documentation",
  "HSE",
  "Supply Chain",
];
export const JOB_TITLES = [
  "QA Manager",
  "QA Specialist",
  "QC Analyst",
  "Lab Technician",
  "Production Operator",
  "Production Supervisor",
  "Validation Engineer",
  "Engineering Manager",
  "Document Controller",
  "HSE Coordinator",
  "HSE Specialist",
  "Warehouse Operator",
];
export const CATEGORY_OPTIONS = [
  { label: "All Categories", value: "All" },
  { label: "GMP", value: "GMP" },
  { label: "Safety", value: "Safety" },
  { label: "Technical", value: "Technical" },
  { label: "Compliance", value: "Compliance" },
];
export const METHOD_OPTIONS = [
  { label: "All Methods", value: "All" },
  { label: "Read & Understood", value: "Read & Understood" },
  { label: "Quiz (Paper-based/Manual)", value: "Quiz (Paper-based/Manual)" },
  { label: "Hands-on/OJT", value: "Hands-on/OJT" },
];
export const TYPE_BADGE_COLORS: Record<string, string> = {
  GMP: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Safety: "bg-amber-50 text-amber-700 border-amber-200",
  Technical: "bg-blue-50 text-blue-700 border-blue-200",
  Compliance: "bg-purple-50 text-purple-700 border-purple-200",
};

export const SCOPE_TABS: TabItem[] = [
  { id: "business_unit", label: "Business Unit", icon: IconBuilding },
  { id: "department", label: "Department", icon: Building2 },
  { id: "individual", label: "Individual", icon: IconUser },
];

export const PRIORITY_OPTIONS = [
  { label: "Critical (≤7 days)", value: "Critical" },
  { label: "High (≤14 days)", value: "High" },
  { label: "Medium (≤30 days)", value: "Medium" },
  { label: "Low (≤60 days)", value: "Low" },
];

// ─── Helper ───────────────────────────────────────────────────────────────────
const addDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

export const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

// ─── Step indicator ───────────────────────────────────────────────────────────
// Step labels are used by WorkflowStepper

// ─── Main Component ───────────────────────────────────────────────────────────
export const AssignTrainingView: React.FC = () => {
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const employees = complianceTrackingRepository.getMatrixEmployees();
  const cells = complianceTrackingRepository.getCells();

  const prefilledCourseId = searchParams.get("courseId") ?? "";
  const prefilledEmployeeId = searchParams.get("employeeId") ?? "";

  // ── Wizard state ─────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    prefilledCourseId && prefilledEmployeeId ? 3 : prefilledCourseId ? 2 : 1,
  );
  const [showESign, setShowESign] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);

  const handleStepChange = (step: WizardStep) => {
    setCurrentStep(step);
  };

  // ── Step 1: Course selection ──────────────────────────────────────
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    return prefilledCourseId || sessionStorage.getItem("assignment_selectedCourseId") || "";
  });

  useEffect(() => {
    if (selectedCourseId) {
      sessionStorage.setItem("assignment_selectedCourseId", selectedCourseId);
    } else {
      sessionStorage.removeItem("assignment_selectedCourseId");
    }
  }, [selectedCourseId]);
  const [courseSearch, setCourseSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reasonForAssignment, setReasonForAssignment] = useState("");

  // ── Step 2: Assignees ─────────────────────────────────────────────
  const [scopeTab, setScopeTab] = useState<AssignmentScope>(
    prefilledEmployeeId ? "individual" : "business_unit",
  );
  const [selectedBusinessUnits, setSelectedBusinessUnits] = useState<string[]>(
    [],
  );
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(
    prefilledEmployeeId ? [prefilledEmployeeId] : [],
  );
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");

  // ── Step 3: Config ────────────────────────────────────────────────
  const [priority, setPriority] = useState<AssignmentPriority>("Medium");
  const [deadlineDate, setDeadlineDate] = useState(
    addDays(PRIORITY_DEADLINE_DAYS["Medium"]),
  );
  const [trainingBeforeAuthorized, setTrainingBeforeAuthorized] =
    useState(false);
  const [requiresESign, setRequiresESign] = useState(false);
  const [isCrossTraining, setIsCrossTraining] = useState(false);
  const [reminders, setReminders] = useState<number[]>([7]);

  // ── Derived data ──────────────────────────────────────────────────
  const selectedCourse = useMemo(
    () =>
      APPROVED_COURSES.find(
        (c) =>
          c.id === selectedCourseId ||
          c.trainingId === selectedCourseId ||
          c.linkedDocumentTitle === selectedCourseId,
      ) ?? null,
    [selectedCourseId],
  );

  const filteredCourses = useMemo(() => {
    return APPROVED_COURSES.filter((c) => {
      const matchesSearch =
        !courseSearch ||
        c.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
        c.trainingId.toLowerCase().includes(courseSearch.toLowerCase());
      const matchesCat = categoryFilter === "All" || c.type === categoryFilter;
      const matchesMethod =
        methodFilter === "All" || c.trainingMethod === methodFilter;

      let matchesDate = true;
      if (dateFrom || dateTo) {
        const d = new Date(2026, 2, 25); // Mocked date for all in this view for now
        if (dateFrom)
          matchesDate =
            matchesDate &&
            d >= new Date(dateFrom.split("/").reverse().join("-"));
        if (dateTo)
          matchesDate =
            matchesDate && d <= new Date(dateTo.split("/").reverse().join("-"));
      }

      return matchesSearch && matchesCat && matchesMethod && matchesDate;
    });
  }, [courseSearch, categoryFilter, methodFilter, dateFrom, dateTo]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const q = employeeSearch.toLowerCase();
      return (
        !q ||
        e.fullName.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q)
      );
    });
  }, [employeeSearch]);

  const resolvedAssignees = useMemo((): EmployeeRow[] => {
    if (scopeTab === "individual")
      return employees.filter((e) => selectedEmployeeIds.includes(e.id));
    if (scopeTab === "department")
      return employees.filter((e) =>
        selectedDepartments.includes(e.department),
      );
    if (scopeTab === "business_unit")
      return employees.filter((e) =>
        selectedBusinessUnits.includes(e.businessUnit || "Operation Unit"),
      );
    return [];
  }, [
    scopeTab,
    selectedEmployeeIds,
    selectedDepartments,
    selectedBusinessUnits,
  ]);

  const totalAssignees = resolvedAssignees.length;

  // ── Validation ────────────────────────────────────────────────────
  const step1Valid = !!selectedCourseId;
  const step2Valid = totalAssignees > 0;
  const step3Valid = !!deadlineDate;
  const step4Valid = reasonForAssignment.trim().length >= 10;
  const needsESign = priority === "Critical" || requiresESign;

  // ── Handlers ──────────────────────────────────────────────────────
  const handlePriorityChange = useCallback((val: string) => {
    const p = val as AssignmentPriority;
    setPriority(p);
    setDeadlineDate(addDays(PRIORITY_DEADLINE_DAYS[p]));
  }, []);

  const handleReminderToggle = (days: number) => {
    setReminders((prev) =>
      prev.includes(days) ? prev.filter((d) => d !== days) : [...prev, days],
    );
  };

  const handleBusinessUnitToggle = (bu: string) => {
    setSelectedBusinessUnits((prev) =>
      prev.includes(bu) ? prev.filter((b) => b !== bu) : [...prev, bu],
    );
  };

  const handleDeptToggle = (dept: string) => {
    setSelectedDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept],
    );
  };

  const handleEmployeeToggle = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );
  };

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep((currentStep + 1) as WizardStep);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as WizardStep);
  };

  const handleCancel = () => {
    setShowCancelModal(true);
  };

  const confirmLeave = () => {
    setShowCancelModal(false);
    sessionStorage.removeItem("assignment_selectedCourseId");
    navigateTo(ROUTES.TRAINING.TRAINING_MATRIX);
  };

  const handleSubmit = () => {
    // Always require e-signature before submitting
    setShowESign(true);
  };

  const doSubmit = async (_reason?: string) => {
    setIsSubmitting(true);
    try {
      await new Promise<void>(resolve => setTimeout(resolve, 800));
      // If this assignment was launched from the matrix (employee + course prefilled),
      // immediately reflect a Pending status in the matrix cell so users see
      // "Đã giao bài, đang chờ kết quả".
      if (prefilledEmployeeId && prefilledCourseId) {
        const key = `${prefilledEmployeeId}|${prefilledCourseId}`;
        const existing = cells.get(key);
        if (existing) {
          cells.set(key, {
            ...existing,
            status: "InProgress",
          });
        }
      }

      sessionStorage.removeItem("assignment_selectedCourseId");
      showToast({
        type: "success",
        title: "Assignment Created",
        message: `Training assigned to ${totalAssignees} employee${totalAssignees !== 1 ? "s" : ""}. Notifications sent.`,
        duration: 4000,
      });
      navigateTo(ROUTES.TRAINING.TRAINING_MATRIX);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Target summary string ─────────────────────────────────────────
  const targetSummary = useMemo(() => {
    if (scopeTab === "individual")
      return `${totalAssignees} employee${totalAssignees !== 1 ? "s" : ""} selected`;
    if (scopeTab === "department")
      return selectedDepartments.length > 0
        ? `${selectedDepartments.join(", ")} (${totalAssignees} employees)`
        : "No departments selected";
    if (scopeTab === "business_unit")
      return selectedBusinessUnits.length > 0
        ? `${selectedBusinessUnits.join(", ")} (${totalAssignees} employees)`
        : "No business units selected";
    return "No assignees selected";
  }, [scopeTab, totalAssignees, selectedDepartments, selectedBusinessUnits]);

  // ────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      {/* Page Header with action buttons */}
      <PageHeader
        title="New Training Assignment"
        breadcrumbItems={breadcrumbs.assignTraining(navigateTo)}
        actions={
          <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={handleCancel}
              className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
            >
              Cancel
            </Button>

            {currentStep > 1 && (
              <Button
                variant="outline-emerald"
                size="sm"
                onClick={handleBack}
                className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
              >
                Previous
              </Button>
            )}
            {currentStep < 4 ? (
              <Button
                variant="outline-emerald"
                size="sm"
                onClick={handleNext}
                disabled={
                  (currentStep === 1 && !step1Valid) ||
                  (currentStep === 2 && !step2Valid) ||
                  (currentStep === 3 && !step3Valid)
                }
                className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                size="sm"
                variant="outline-emerald"
                disabled={isSubmitting || !step4Valid}
                className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
              >
                {isSubmitting ? "Submitting…" : "Sign & Submit"}
              </Button>
            )}
          </div>
        }
      />

      {/* Step indicator */}
      <WorkflowStepper
        steps={STEP_LABELS}
        icons={STEP_ICONS}
        currentStepIndex={currentStep - 1}
        onStepClick={(index) => handleStepChange((index + 1) as WizardStep)}
      />

      {/* Step content */}
      <div className="flex-1 w-full animate-in fade-in duration-300">
        {currentStep === 1 && (
          <Step1CourseSelect
            courses={filteredCourses}
            selectedCourseId={selectedCourseId}
            onSelectCourse={setSelectedCourseId}
            courseSearch={courseSearch}
            onSearchChange={setCourseSearch}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            methodFilter={methodFilter}
            onMethodChange={setMethodFilter}
            dateFrom={dateFrom}
            onDateFromChange={setDateFrom}
            dateTo={dateTo}
            onDateToChange={setDateTo}
            selectedCourse={selectedCourse}
            navigateTo={navigateTo}
          />
        )}
        {currentStep === 2 && (
          <Step2Assignees
            scopeTab={scopeTab}
            onScopeChange={(id) => setScopeTab(id as AssignmentScope)}
            employees={filteredEmployees}
            selectedEmployeeIds={selectedEmployeeIds}
            onEmployeeToggle={handleEmployeeToggle}
            selectedDepartments={selectedDepartments}
            onDeptToggle={handleDeptToggle}
            selectedBusinessUnits={selectedBusinessUnits}
            onBusinessUnitToggle={handleBusinessUnitToggle}
            resolvedAssignees={resolvedAssignees}
            employeeSearch={employeeSearch}
            onEmployeeSearchChange={setEmployeeSearch}
          />
        )}
        {currentStep === 3 && (
          <Step3Config
            priority={priority}
            onPriorityChange={handlePriorityChange}
            deadlineDate={deadlineDate}
            onDeadlineChange={setDeadlineDate}
            trainingBeforeAuthorized={trainingBeforeAuthorized}
            onToggleBeforeAuth={() => setTrainingBeforeAuthorized((v) => !v)}
            requiresESign={requiresESign}
            onToggleESign={() => setRequiresESign((v) => !v)}
            isCrossTraining={isCrossTraining}
            onToggleCrossTraining={() => setIsCrossTraining((v) => !v)}
            reminders={reminders}
            onReminderToggle={handleReminderToggle}
          />
        )}
        {currentStep === 4 && (
          <Step4Review
            course={selectedCourse}
            reasonForAssignment={reasonForAssignment}
            onReasonChange={setReasonForAssignment}
            targetSummary={targetSummary}
            resolvedAssignees={resolvedAssignees}
            priority={priority}
            deadlineDate={deadlineDate}
            trainingBeforeAuthorized={trainingBeforeAuthorized}
            requiresESign={requiresESign}
            isCrossTraining={isCrossTraining}
            reminders={reminders}
            needsESign={needsESign}
          />
        )}
      </div>
      {/* Footer Action Buttons */}
      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
        <Button
          variant="outline-emerald"
          size="sm"
          onClick={handleCancel}
          className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
        >
          Cancel
        </Button>

        {currentStep > 1 && (
          <Button
            variant="outline-emerald"
            size="sm"
            onClick={handleBack}
            className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
          >
            Previous
          </Button>
        )}
        {currentStep < 4 ? (
          <Button
            variant="outline-emerald"
            size="sm"
            onClick={handleNext}
            disabled={
              (currentStep === 1 && !step1Valid) ||
              (currentStep === 2 && !step2Valid) ||
              (currentStep === 3 && !step3Valid)
            }
            className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            size="sm"
            variant="outline-emerald"
            disabled={isSubmitting || !step4Valid}
            className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
          >
            {isSubmitting ? "Submitting…" : "Sign & Submit"}
          </Button>
        )}
      </div>

      {/* E-Signature Modal */}
      <ESignatureModal
        isOpen={showESign}
        onClose={() => setShowESign(false)}
        onConfirm={(data) => doSubmit(data.reason)}
        actionTitle="Authorize Training Assignment"
      />

      {/* Cancel confirmation modal */}
      <AlertModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={confirmLeave}
        type="warning"
        title="Discard assignment?"
        description="Are you sure you want to leave? Your progress will not be saved."
        cancelText="Cancel"
        confirmText="OK"
      />

      {isNavigating && <FullPageLoading text="Loading..." />}
    </div>
  );
};

