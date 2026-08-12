import React, { useState } from "react";
import { useParams, useSearchParams, useLocation } from "react-router-dom";
import { useNavigateWithLoading } from "@/hooks";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import {
  Check,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { courseDetail, courseDetailFromAssignment } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { FormSection } from "@/components/ui/form";
import { getStatusColorClass } from "@/utils/status";
import {
  TrainingStatus,
} from "../types";
import { BasicInfoTab } from "../../shared/BasicInfoTab";
import { DocumentTab } from "../../shared/DocumentTab";
import { ConfigTab } from "../../shared/ConfigTab";
import { CourseAuditTrailTab } from "../../shared/CourseAuditTrailTab";
import { MOCK_COURSES, MOCK_TRAININGS } from "../mockData";
import { TrainingRecord } from "../types";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { MATERIAL_WORKFLOW_USERS } from "@/features/training/materials/views/materialWorkflowUsers";
import type { CourseApprover, CourseReviewer } from "../../shared/workflow.types";
import { CourseReviewersTab } from "../../shared/CourseReviewersTab";
import { CourseApproversTab } from "../../shared/CourseApproversTab";

// Tab types
type TabType =
  | "basic-info"
  | "document-training"
  | "training-config"
  | "reviewers"
  | "approvers"
  | "audit-trail";

const TABS: { id: TabType; label: string }[] = [
  { id: "basic-info", label: "Basic Information" },
  { id: "document-training", label: "Training Materials" },
  { id: "training-config", label: "Assessment Config" },
  { id: "reviewers", label: "Reviewers" },
  { id: "approvers", label: "Approvers" },
  { id: "audit-trail", label: "Audit Trail" },
];

// Workflow stepper steps
const WORKFLOW_STEPS = [
  "Draft",
  "Pending Review",
  "Pending Approval",
  "Effective",
  "Obsoleted",
  "Closed - Cancelled",
] as const;


const getWorkflowStepForStatus = (status: TrainingStatus) => {
  // Mapping training status to workflow step
  switch (status) {
    case "Draft":
      return 0;
    case "Pending Review":
      return 1;
    case "Pending Approval":
      return 2;
    case "Effective":
      return 3;
    case "Obsoleted":
      return 4;
    case "Closed - Cancelled":
      return 5;
    default:
      return 0;
  }
};

export const CourseDetailView: React.FC = () => {
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");
  const { courseId = "" } = useParams<{ courseId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>("basic-info");

  const backPath = from === "assignment" ? ROUTES.TRAINING.ASSIGNMENT_NEW : ROUTES.TRAINING.COURSES_LIST;

  const handleBack = () => {
    const fromPath = location.state?.from ? `${ROUTES.TRAINING.COURSES_LIST}${location.state.from}` : backPath;
    navigateBack(navigateTo as any, location.state as any, fromPath);
  };

  // Find course by ID with fallback to MOCK_TRAININGS
  const rawCourse = MOCK_COURSES.find((c) => c.id === courseId) ||
    (MOCK_TRAININGS.find((t) => t.id === courseId) as any);

  const course = rawCourse ? (() => {
    const obsoleted = JSON.parse(localStorage.getItem("obsoleted_courses") || "[]");
    if (obsoleted.includes(rawCourse.trainingId) || obsoleted.includes(rawCourse.id)) {
      return { ...rawCourse, status: "Obsoleted" as any };
    }
    return rawCourse;
  })() : null;

  if (!course) {
    return (
      <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2"
          >
            Back
          </Button>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-lg font-medium text-slate-900">Course not found</p>
          <p className="text-sm text-slate-500 mt-1">
            The requested training course does not exist.
          </p>
        </div>
      </div>
    );
  }

  const currentStepIndex = getWorkflowStepForStatus(course.status);
  const reviewers: CourseReviewer[] = course.reviewers || [];
  const approvers: CourseApprover[] = course.approvers || [];

  const renderTabContent = () => {
    switch (activeTab) {
      case "basic-info":
        return (
          <BasicInfoTab
            readOnly
            courseId={course.trainingId}
            courseName={course.courseName}
            description={course.description || ""}
            trainingType={course.type}
            trainingMethod={course.trainingMethod}
            instructorType={course.instructorType}
            instructor={course.instructor}
            scheduledDate={course.scheduledDate}
            duration={course.duration}
            location={course.location}
            capacity={course.capacity}
            recurrence={
              course.recurrence || { enabled: false, intervalMonths: 0, warningPeriodDays: 30 }
            }
            linkedDocumentId={course.linkedDocumentId}
            linkedDocumentTitle={course.linkedDocumentTitle}
            evidenceFiles={[]}
            periodicReviewCycle={course.periodicReviewCycle}
            periodicReviewNotification={course.periodicReviewNotification}
            effectiveDate={course.effectiveDate}
            validUntil={course.validUntil}
            reviewDate={course.reviewDate}
          />
        );
      case "document-training":
        return (
          <DocumentTab
            readOnly
            trainingFiles={course.trainingFiles}
            instruction={course.instruction}
          />
        );
      case "training-config":
        return (
          <ConfigTab
            readOnly
            trainingMethod={course.trainingMethod}
            examTemplateName={course.examTemplate}
            answerKeyName={course.answerKey}
            passingGradeType={course.passingGradeType}
            passingScore={course.passScore}
            maxAttempts={course.maxAttempts}
          />
        );
      case "reviewers":
        return (
          <CourseReviewersTab
            reviewers={reviewers}
            onReviewersChange={() => undefined}
            users={MATERIAL_WORKFLOW_USERS}
            readOnly
          />
        );
      case "approvers":
        return (
          <CourseApproversTab
            approvers={approvers}
            onApproversChange={() => undefined}
            users={MATERIAL_WORKFLOW_USERS}
            readOnly
          />
        );
      case "audit-trail":
        return <CourseAuditTrailTab />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      {/* Header */}
      <PageHeader
        title="Course Detail"
        breadcrumbItems={from === "assignment" ? courseDetailFromAssignment(navigateTo) : courseDetail(navigateTo, location.state?.from)}
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={handleBack}
              className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
            >
              Back
            </Button>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={() => navigateTo(ROUTES.TRAINING.COURSE_EDIT(courseId))}
              className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
            >
              Edit Course
            </Button>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={() => navigateTo(ROUTES.TRAINING.COURSE_PROGRESS(courseId))}
              className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
            >
              View Progress
            </Button>
            {course.trainingMethod === "Quiz (Paper-based/Manual)" && (
              <Button
                variant="outline-emerald"
                size="sm"
                onClick={() =>
                  navigateTo(ROUTES.TRAINING.COURSE_RESULT_ENTRY(courseId))
                }
                className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
              >
                Result Entry
              </Button>
            )}
          </>
        }
      />

      {/* Status Workflow Stepper */}
      <WorkflowStepper steps={WORKFLOW_STEPS} currentStepIndex={currentStepIndex} />

      {/* Tab Container */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Tab Navigation */}
        <TabNav
          tabs={TABS}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabType)}
        />

        {/* Tab Content */}
        <div className="animate-in fade-in duration-200">
          {renderTabContent()}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-wrap justify-start gap-2">
        <Button
          variant="outline-emerald"
          size="sm"
          onClick={handleBack}
          className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
        >
          Back
        </Button>
        <Button
          variant="outline-emerald"
          size="sm"
          onClick={() => navigateTo(ROUTES.TRAINING.COURSE_EDIT(courseId))}
          className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
        >
          Edit Course
        </Button>
        <Button
          variant="outline-emerald"
          size="sm"
          onClick={() => navigateTo(ROUTES.TRAINING.COURSE_PROGRESS(courseId))}
          className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
        >
          View Progress
        </Button>
        {course.trainingMethod === "Quiz (Paper-based/Manual)" && (
          <Button
            variant="outline-emerald"
            size="sm"
            onClick={() =>
              navigateTo(ROUTES.TRAINING.COURSE_RESULT_ENTRY(courseId))
            }
            className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
          >
            Result Entry
          </Button>
        )}
      </div>



      {/* ─── Loading Overlay ──────────────────────────────────── */}
      {isNavigating && <FullPageLoading text="Loading..." />}
    </div>
  );
};
