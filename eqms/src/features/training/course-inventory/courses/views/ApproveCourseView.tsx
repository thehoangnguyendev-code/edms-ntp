import React, { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import { XCircle, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { courseApproval } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { ESignatureModal } from "@/components/ui/esign-modal";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { MOCK_APPROVAL_DETAILS } from "../mockData";
import { BasicInfoTab } from "../../shared/BasicInfoTab";
import { DocumentTab } from "../../shared/DocumentTab";
import { ConfigTab } from "../../shared/ConfigTab";
import { CourseAuditTrailTab } from "../../shared/CourseAuditTrailTab";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { MATERIAL_WORKFLOW_USERS } from "../../../materials/views/materialWorkflowUsers";
import type { CourseApprover, CourseReviewer } from "../../shared/workflow.types";
import { CourseReviewersTab } from "../../shared/CourseReviewersTab";
import { CourseApproversTab } from "../../shared/CourseApproversTab";
import type { TrainingType, TrainingMethod, Recurrence } from "../../../types";
import { useTrainingPermissions } from "@/features/training/useTrainingPermissions";
import { navigateBack } from "@/app/navigation/backNavigation";

type TabType =
  | "basic-info"
  | "document-training"
  | "training-config"
  | "reviewers"
  | "approvers"
  | "audit-trail";

const TABS: TabItem[] = [
  { id: "basic-info", label: "Basic Information" },
  { id: "document-training", label: "Training Materials" },
  { id: "training-config", label: "Assessment Config" },
  { id: "reviewers", label: "Reviewers" },
  { id: "approvers", label: "Approvers" },
  { id: "audit-trail", label: "Audit Trail" },
];

const WORKFLOW_STEPS = [
  "Draft",
  "Pending Review",
  "Pending Approval",
  "Effective",
  "Obsoleted",
  "Closed - Cancelled",
] as const;
type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

export const ApproveCourseView: React.FC = () => {
  const navigate = useNavigate();
  const { canApproveCourses } = useTrainingPermissions();
  const { courseId } = useParams<{ courseId: string }>();
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNavigateBack = () => {
    setIsNavigating(true);
    setTimeout(() => navigateBack(navigate, location.state as any, ROUTES.TRAINING.COURSES_LIST), 600);
  };

  const [activeTab, setActiveTab] = useState<TabType>("basic-info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showesignModal, setShowesignModal] = useState(false);
  const [eSignAction, setESignAction] = useState<"approve" | "reject" | null>(
    null,
  );

  const original = MOCK_APPROVAL_DETAILS.find((a) => a.id === courseId || a.courseId === courseId);

  // Local status override to reflect stepper advancement after action
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  if (!original) {
    return (
      <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNavigateBack}
            className="gap-2"
          >
            Back
          </Button>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-lg font-medium text-slate-900">Course not found</p>
          <p className="text-sm text-slate-500 mt-1">
            The requested course does not exist.
          </p>
        </div>
      </div>
    );
  }

  const approval = {
    ...original,
    approvalStatus: localStatus ?? original.approvalStatus,
  };
  const effectiveStatus = approval.approvalStatus;
  const isRejected = effectiveStatus === "Rejected";
  const canAct = effectiveStatus === "Pending Approval" && canApproveCourses;

  const files = approval.trainingFiles || [];

  const handleApprove = () => {
    setESignAction("approve");
    setShowesignModal(true);
  };

  const handleReject = () => {
    setESignAction("reject");
    setShowesignModal(true);
  };

  const handleESignConfirm = async (reason: string) => {
    setIsSubmitting(true);
    try {
      await new Promise<void>(resolve => setTimeout(resolve, 500));
      if (eSignAction === "approve") {
        setLocalStatus("Effective");
      } else {
        setRejectionReason(reason);
        setLocalStatus("Rejected");
      }
      setESignAction(null);
      setShowesignModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStepIndex = isRejected
    ? 0
    : WORKFLOW_STEPS.indexOf(approval.approvalStatus as any);

  const reviewers: CourseReviewer[] = approval.reviewers || [];
  const approvers: CourseApprover[] = approval.approvers || [];

  const renderTabContent = () => {
    switch (activeTab) {
      case "basic-info":
        return (
          <BasicInfoTab
            readOnly
            courseId={approval.trainingId}
            courseName={approval.courseName}
            description={approval.description || ""}
            trainingType={(approval.trainingType as TrainingType) || "GMP"}
            trainingMethod={
              (approval.trainingMethod as TrainingMethod) || "Read & Understood"
            }
            instructorType={(approval.instructorType as any) || "internal"}
            instructor={approval.instructor || ""}
            scheduledDate={approval.scheduledDate || ""}
            duration={approval.duration || 0}
            location={approval.location || ""}
            capacity={approval.capacity || 0}
            recurrence={
              (approval.recurrence as Recurrence) || {
                enabled: false,
                intervalMonths: 0,
                warningPeriodDays: 0,
              }
            }
            linkedDocumentIds={
              approval.relatedDocumentId ? [approval.relatedDocumentId] : []
            }
            linkedDocumentId={approval.relatedDocumentId || ""}
            linkedDocumentTitle={approval.relatedDocument || ""}
            evidenceFiles={[] as File[]}
            periodicReviewCycle={approval.periodicReviewCycle}
            periodicReviewNotification={approval.periodicReviewNotification}
            effectiveDate={approval.effectiveDate}
            validUntil={approval.validUntil}
            reviewDate={approval.reviewDate}
          />
        );
      case "document-training":
        return (
          <DocumentTab
            readOnly
            trainingFiles={files}
            instruction={approval.instruction || ""}
          />
        );
      case "training-config":
        return (
          <ConfigTab
            readOnly
            trainingMethod={
              (approval.trainingMethod as any) || "Read & Understood"
            }
            examTemplateName={approval.examTemplate}
            answerKeyName={approval.answerKey}
            passingGradeType={approval.passingGradeType}
            passingScore={approval.passScore}
            maxAttempts={approval.maxAttempts}
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
        title="Approve Course"
        breadcrumbItems={courseApproval(navigate, location.state?.from)}
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={handleNavigateBack}
              className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
            >
              Cancel
            </Button>
            {canAct && (
              <>
                <Button
                  variant="outline-emerald"
                  size="sm"
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
                >
                  {isSubmitting ? "Processing..." : "Reject"}
                </Button>
                <Button
                  variant="outline-emerald"
                  size="sm"
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
                >
                  {isSubmitting ? "Processing..." : "Complete Approve"}
                </Button>
              </>
            )}
          </>
        }
      />

      {/* Workflow Stepper */}
      <WorkflowStepper steps={WORKFLOW_STEPS} currentStepIndex={currentStepIndex} />
      {isRejected && (
        <WarningBanner
          variant="error"
          title="Course Rejected"
          description={rejectionReason}
          className="mt-4"
        />
      )}

      {/* Tab Container */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <TabNav tabs={TABS} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabType)} />
        <div className="animate-in fade-in duration-200">
          {renderTabContent()}
        </div>
      </div>

      {/* E-Signature Modal */}
      <ESignatureModal
        isOpen={showesignModal}
        onClose={() => {
          setShowesignModal(false);
          setESignAction(null);
        }}
        onConfirm={(data) => handleESignConfirm(data.reason)}
        actionTitle={
          eSignAction === "approve" ? "Approve Course" : "Reject Course"
        }
      />

      {/* ─── Loading Overlay ──────────────────────────────────── */}
      {(isSubmitting || isNavigating) && <FullPageLoading text="Processing..." />}
    </div>
  );
};
