import React, { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { ROUTES } from "@/app/routes.constants";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormSection } from "@/components/ui/form";
import { Select } from "@/components/ui/select/Select";
import { courseObsoleteImpactAssessment } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { useNavigateWithLoading } from "@/hooks";
import { useToast } from "@/components/ui/toast/Toast";
import { useTranslation } from "@/i18n";
import { MOCK_COURSES, MOCK_TRAININGS } from "../mockData";
import { IconChecklist, IconPointerBolt } from "@tabler/icons-react";
import { navigateBack } from "@/app/navigation/backNavigation";

type CheckSeverity = "pass" | "warning" | "block";

interface ImpactCheckItem {
  id: string;
  label: string;
  detail: string;
  count: number;
  severity: CheckSeverity;
  blocking: boolean;
}

interface ImpactDetailGroup {
  title: string;
  items: string[];
}

const getSeverityUi = (severity: CheckSeverity) => {
  if (severity === "block") {
    return {
      badgeColor: "red" as const,
      text: "Blocked",
    };
  }

  if (severity === "warning") {
    return {
      badgeColor: "amber" as const,
      text: "Warning",
    };
  }

  return {
    badgeColor: "emerald" as const,
    text: "Pass",
  };
};

const hashString = (value: string) =>
  Array.from(value).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

export const ObsoleteImpactAssessmentView: React.FC = () => {
  const { courseId = "" } = useParams<{ courseId: string }>();
  const location = useLocation();
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [replacementCourse, setReplacementCourse] = useState("");
  const [sunsetDate, setSunsetDate] = useState("");
  const [mitigationPlan, setMitigationPlan] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [selectedImpact, setSelectedImpact] = useState<ImpactCheckItem | null>(null);
  const [isESignatureModalOpen, setIsESignatureModalOpen] = useState(false);

  const stateFrom = (location.state as { from?: string } | null)?.from;
  const resolvedFrom = stateFrom
    ? stateFrom.startsWith("?")
      ? `${ROUTES.TRAINING.COURSES_LIST}${stateFrom}`
      : stateFrom
    : ROUTES.TRAINING.COURSES_LIST;

  const rawCourse =
    MOCK_COURSES.find((course) => course.id === courseId) ||
    MOCK_TRAININGS.find((course) => course.id === courseId);

  const course = rawCourse || null;

  const checks = useMemo<ImpactCheckItem[]>(() => {
    if (!course) return [];

    const base = hashString(course.trainingId || course.id || "course");
    const isEffective = course.status === "Effective";

    const activeSessions = isEffective ? (base % 3 === 0 ? 2 : 0) : 0;
    const inProgressLearners = isEffective ? (base % 6 === 0 ? 5 : 2) : 0;
    const inProgressResultEntry = isEffective ? (base % 4 === 0 ? 1 : 0) : 0;
    const pendingAssignments = isEffective ? (base % 5 === 0 ? 3 : 0) : 0;
    const dependentRecords = base % 2 === 0 ? 4 : 1;

    return [
      {
        id: "active-sessions",
        label: "Running Classes",
        detail: "Training classes currently in Scheduled or In-Progress execution windows.",
        count: activeSessions,
        severity: activeSessions > 0 ? "block" : "pass",
        blocking: activeSessions > 0,
      },
      {
        id: "in-progress-learners",
        label: "In-Progress Learners",
        detail: "Learners currently in progress and not yet completed for this course.",
        count: inProgressLearners,
        severity: inProgressLearners > 0 ? "warning" : "pass",
        blocking: false,
      },
      {
        id: "result-entry",
        label: "Result Entry in Progress",
        detail: "Courses with assessment/result-entry activities not fully completed.",
        count: inProgressResultEntry,
        severity: inProgressResultEntry > 0 ? "block" : "pass",
        blocking: inProgressResultEntry > 0,
      },
      {
        id: "assignments",
        label: "Assignments",
        detail: "Assigned learners not yet completed or acknowledged.",
        count: pendingAssignments,
        severity: pendingAssignments > 0 ? "warning" : "pass",
        blocking: false,
      },
      {
        id: "dependent-records",
        label: "Related Records",
        detail: "Historical records and evidence referencing this course version.",
        count: dependentRecords,
        severity: dependentRecords > 0 ? "warning" : "pass",
        blocking: false,
      },
    ];
  }, [course]);

  const blockingChecks = checks.filter((item) => item.blocking);
  const warningChecks = checks.filter((item) => item.severity === "warning");
  const hasBlockingIssue = blockingChecks.length > 0;

  const impactDetails = useMemo<Record<string, ImpactDetailGroup>>(() => {
    const trainingCode = course?.trainingId ?? "TRN";

    return {
      "active-sessions": {
        title: "Running Classes",
        items: [
          `${trainingCode} - Batch A | Scheduled`,
          `${trainingCode} - Batch B | In-Progress`,
          `${trainingCode} - Batch C | Pending start`,
        ],
      },
      "in-progress-learners": {
        title: "In-Progress Learners",
        items: [
          "Nguyen Van A - In progress",
          "Tran Thi B - In progress",
          "Le Van C - Awaiting completion",
          "Pham Thi D - Needs review",
        ],
      },
      "result-entry": {
        title: "Result Entry in Progress",
        items: [
          "Result entry for Batch A - Pending",
          "Result entry for Batch B - In review",
          "Exam scoring sheet - Not finalized",
        ],
      },
      "assignments": {
        title: "Assignments",
        items: [
          "Assignment #A-101 - Awaiting acknowledgment",
          "Assignment #A-102 - Due today",
          "Assignment #A-103 - Reassigned to backup learner",
        ],
      },
      "dependent-records": {
        title: "Related Records",
        items: [
          `${trainingCode}-R1 - Completion record linked`,
          `${trainingCode}-R2 - Attendance evidence linked`,
          `${trainingCode}-R3 - Audit trail reference`,
          `${trainingCode}-R4 - Historical version reference`,
        ],
      },
    };
  }, [course]);

  const selectedImpactDetails =
    selectedImpact ? impactDetails[selectedImpact.id] : null;

  const replacementCourseOptions = useMemo(
    () =>
      MOCK_TRAININGS.filter(
        (item) => item.id !== courseId && item.status === "Effective"
      ).map((item) => ({
        label: `${item.trainingId} - ${item.title}`,
        value: item.trainingId,
      })),
    [courseId]
  );

  const canProceed =
    !hasBlockingIssue &&
    acknowledged &&
    replacementCourse.trim().length > 0 &&
    sunsetDate.trim().length > 0 &&
    mitigationPlan.trim().length > 0;

  const handleBack = () => {
    navigateBack(navigateTo as any, location.state as any, resolvedFrom);
  };

  const handleProceed = async (reason: string) => {
    if (!course) return;

    showToast({
      type: "success",
      title: t("courseImpact.completedTitle"),
      message: t("courseImpact.completedMessage", { id: course.trainingId, reason }),
      duration: 3500,
    });

    setIsESignatureModalOpen(false);

    navigateTo(ROUTES.TRAINING.COURSE_DETAIL(course.id), {
      state: {
        from: `${ROUTES.TRAINING.COURSES_LIST}?tab=inventory`,
        assessmentPassed: true,
      },
    });
  };

  if (!course) {
    return (
      <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
        <PageHeader
          title="Impact Analysis"
          breadcrumbItems={courseObsoleteImpactAssessment(navigateTo, stateFrom)}
          actions={
            <Button variant="outline-emerald" size="sm" onClick={handleBack}>
              Back
            </Button>
          }
        />

        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <p className="text-base font-semibold text-slate-900">Course not found</p>
          <p className="text-sm text-slate-500 mt-1">Cannot perform impact assessment for a missing course.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Impact Analysis"
        breadcrumbItems={courseObsoleteImpactAssessment(navigateTo, stateFrom)}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline-emerald" size="sm" onClick={handleBack} disabled={isNavigating}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => setIsESignatureModalOpen(true)}
            //   disabled={!canProceed || isNavigating}
              className="whitespace-nowrap"
            >
              Continue to Obsolete
            </Button>
          </div>
        }
      />

      {hasBlockingIssue ? (
        <WarningBanner
          variant="error"
          title="Obsolete Blocked"
          description={`There are ${blockingChecks.length} blocking condition(s). Resolve all blockers before obsoleting this course.`}
        />
      ) : (
        <WarningBanner
          variant="info"
          title="Assessment Ready"
          description="No critical blockers found. Complete mitigation plan and acknowledgement to continue obsolete workflow."
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">Course ID</p>
          <p className="text-sm font-semibold text-slate-900 mt-1">{course.trainingId}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">Current Status</p>
          <p className="text-sm font-semibold text-slate-900 mt-1">{course.status}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">Warnings</p>
          <p className="text-sm font-semibold text-slate-900 mt-1">{warningChecks.length}</p>
        </div>
      </div>

      <FormSection title="Impact Check Matrix" icon={<IconPointerBolt className="h-4 w-4" />}>
        <div className="space-y-3">
          {checks.map((item) => {
            const severityUi = getSeverityUi(item.severity);
            return (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 md:p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.detail}</p>
                  </div>
                  <div className="flex w-full sm:w-auto shrink-0 flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 items-start sm:justify-end">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">{item.count} affected</span>
                      <Badge color={severityUi.badgeColor} size="sm">
                        {severityUi.text}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline-emerald"
                      size="sm"
                      onClick={() => setSelectedImpact(item)}
                      disabled={item.count === 0}
                      className="w-full sm:w-auto"
                    >
                      View details
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </FormSection>

      <FormSection title="Mitigation Plan" icon={<IconChecklist className="h-4 w-4" />}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-1">
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Replacement Course</label>
            <Select
              value={replacementCourse}
              onChange={(value) => setReplacementCourse(String(value))}
              options={
                replacementCourseOptions.length > 0
                  ? replacementCourseOptions
                  : [{ label: "No effective replacement course", value: "" }]
              }
              placeholder="Select replacement course"
              enableSearch
            />
          </div>

          <div className="lg:col-span-1">
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Sunset Effective Date</label>
            <DateTimePicker
              value={sunsetDate}
              onChange={setSunsetDate}
              placeholder="Select sunset date"
            />
          </div>

          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Mitigation Actions
            </label>
            <textarea
              value={mitigationPlan}
              onChange={(event) => setMitigationPlan(event.target.value)}
              rows={4}
              placeholder="Describe migration plan for active learners, pending results, and communication steps."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="lg:col-span-2">
            <Checkbox
              checked={acknowledged}
              onChange={setAcknowledged}
              label="I confirm that all blockers were reviewed and mitigation actions are approved before obsoleting this course."
              className="items-start"
              labelClassName="leading-relaxed"
            />
          </div>
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <Button variant="outline-emerald" size="sm" onClick={handleBack} disabled={isNavigating}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="outline-emerald"
          onClick={() => setIsESignatureModalOpen(true)}
        //   disabled={!canProceed || isNavigating}
          className="whitespace-nowrap"
        >
          Continue to Obsolete
        </Button>
      </div>

      {selectedImpact && selectedImpactDetails ? (
        <FormModal
          isOpen={true}
          onClose={() => setSelectedImpact(null)}
          title={`${selectedImpact.label} Details`}
          description={`${selectedImpact.count} affected item(s) found in ${selectedImpactDetails.title.toLowerCase()}.`}
          confirmText="Close"
          cancelText=""
          showCancel={false}
          onConfirm={() => setSelectedImpact(null)}
          size="lg"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500 font-medium">Group</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{selectedImpactDetails.title}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500 font-medium">Affected Count</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{selectedImpact.count}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500 font-medium">Severity</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{getSeverityUi(selectedImpact.severity).text}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Affected Items</p>
              </div>
              <div className="divide-y divide-slate-200">
                {selectedImpactDetails.items.slice(0, selectedImpact.count || selectedImpactDetails.items.length).map((entry, index) => (
                  <div key={`${selectedImpact.id}-${index}`} className="px-4 py-3 flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 text-2xs font-semibold text-slate-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{entry}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FormModal>
      ) : null}

      <ESignatureModal
        isOpen={isESignatureModalOpen}
        onClose={() => setIsESignatureModalOpen(false)}
        onConfirm={(data) => handleProceed(data.reason)}
        actionTitle="Confirm Obsolete"
        changes={[
          {
            action: "Update Status",
            oldValue: course.status,
            newValue: "Obsoleted",
            category: "status",
          },
          {
            action: "Record Impact Assessment",
            oldValue: "Pending",
            newValue: "Approved",
            category: "metadata",
          },
        ]}
        targetDetails={{
          code: course.trainingId,
          title: course.title,
          revision: course.version,
        }}
      />
    </div>
  );
};
