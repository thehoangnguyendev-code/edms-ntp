import React, { useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { courseCreate, courseEdit } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Check } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { Button } from "@/components/ui/button/Button";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { ButtonLoading, FullPageLoading } from "@/components/ui/loading/Loading";
import { AlertModal, AlertModalType } from "@/components/ui/modal/AlertModal";
import { NavigationGuardModal } from "@/components/ui/modal/NavigationGuardModal";
import {
  TrainingConfig,
  TrainingType,
  TrainingFile,
  TrainingMethod,
  Recurrence,
} from "../types";
import { BasicInfoTab } from "../../shared/BasicInfoTab";
import { DocumentTab } from "../../shared/DocumentTab";
import { ConfigTab } from "../../shared/ConfigTab";
import { CourseAuditTrailTab } from "../../shared/CourseAuditTrailTab";
import { MOCK_COURSES, MOCK_TRAININGS } from "../mockData";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { MATERIAL_WORKFLOW_USERS } from "../../../materials/views/materialWorkflowUsers";
import type { CourseApprover, CourseReviewer, UploadedFile } from "../../shared/workflow.types";
import { CourseReviewersTab, ReviewerSelectionModal } from "../../shared/CourseReviewersTab";
import { CourseApproversTab, ApproverSelectionModal } from "../../shared/CourseApproversTab";
import type { MaterialWorkflowUser } from "../../../materials/views/materialWorkflowUsers";
import { ESignatureModal } from "@/components/ui/esign-modal";
import { useTrainingPermissions } from "@/features/training/useTrainingPermissions";
import { navigateBack } from "@/app/navigation/backNavigation";

type TabType = "basic-info" | "document-training" | "training-config" | "reviewers" | "approvers" | "audit-trail";

const WORKFLOW_STEPS = [
  "Draft",
  "Pending Review",
  "Pending Approval",
  "Effective",
  "Obsoleted",
  "Closed - Cancelled",
] as const;

// Mock existing course data
const MOCK_COURSE_DATA = {
  id: "1",
  trainingId: "TRN-2026-001",
  courseName: "GMP Basic Principles",
  description:
    "This comprehensive training covers the fundamental principles of Good Manufacturing Practice (GMP) required for all personnel working in pharmaceutical manufacturing environments.",
  trainingType: "GMP" as TrainingType,
  trainingMethod: "Quiz (Paper-based/Manual)" as TrainingMethod,
  instructorType: "internal" as "internal" | "external",
  instructor: "Dr. Sarah Williams",
  scheduledDate: "2026-03-15",
  duration: 4,
  location: "Training Room A",
  capacity: 25,
  linkedDocumentId: "DOC-001",
  linkedDocumentTitle: "SOP-QA-001: Good Manufacturing Practices",
  recurrence: { enabled: true, intervalMonths: 12, warningPeriodDays: 30 } as Recurrence,
  instruction:
    "Focus on Chapter 3 (Cleaning Validation) and Appendix B (Equipment Handling). Review all SOPs referenced in Section 2.4 before the training session.",
  trainingFiles: [
    {
      id: "tf-001",
      file: null as any,
      name: "GMP_Training_Materials_2026.pdf",
      size: 2456789,
      type: "application/pdf",
      progress: 100,
      status: "success" as const,
    },
    {
      id: "tf-002",
      file: null as any,
      name: "GMP_Presentation_Slides.pptx",
      size: 8765432,
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      progress: 100,
      status: "success" as const,
    },
  ],
  workflowStep: 3, // Approved
};

interface CourseEditorContentProps {
  mode: "create" | "edit";
  initialData?: any;
  title: string;
  breadcrumbItems: any;
}

const CourseEditorContent: React.FC<CourseEditorContentProps> = ({
  mode,
  initialData,
  title,
  breadcrumbItems,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { canCreateCourses, canEditCourses, canSubmitCourses } =
    useTrainingPermissions();
  const [activeTab, setActiveTab] = useState<TabType>("basic-info");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDiscardGuard, setShowDiscardGuard] = useState(false);
  const [modalType, setModalType] = useState<AlertModalType>("info");
  const [modalTitle, setModalTitle] = useState("");
  const [modalDescription, setModalDescription] = useState<React.ReactNode>("");
  const [modalAction, setModalAction] = useState<(() => void | Promise<void>) | null>(null);
  const [modalConfirmText, setModalConfirmText] = useState<string | undefined>(undefined);
  const [modalCancelText, setModalCancelText] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isCourseSaved, setIsCourseSaved] = useState(false);
  const [showESignModal, setShowESignModal] = useState(false);

  // ID Generation for Create mode
  const [generatedId] = useState(() => {
      if (mode === "edit") return "";
      const now = new Date();
      const year = now.getFullYear();
      const seq = String(Math.floor(Math.random() * 900) + 100);
      return `TRN-${year}-${seq}`;
  });

  const courseId = mode === "edit" ? initialData?.trainingId : generatedId;

  // Basic Training Info
  const [courseName, setCourseName] = useState(initialData?.courseName || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [trainingType, setTrainingType] = useState<TrainingType>(initialData?.trainingType || "GMP");
  const [trainingMethod, setTrainingMethod] = useState<TrainingMethod>(initialData?.trainingMethod || "Read & Understood");
  const [instructorType, setInstructorType] = useState<"internal" | "external">(initialData?.instructorType || "internal");
  const [instructor, setInstructor] = useState(initialData?.instructor || "");
  const [scheduledDate, setScheduledDate] = useState(initialData?.scheduledDate || "");
  const [duration, setDuration] = useState(initialData?.duration || 4);
  const [trainingLocation, setLocation] = useState(initialData?.location || "");
  const [capacity, setCapacity] = useState(initialData?.capacity || 30);

  // Linked documents
  const [linkedDocumentIds, setLinkedDocumentIds] = useState<(string | number)[]>(
    initialData?.linkedDocumentId ? [initialData.linkedDocumentId] : []
  );

  // Recurrence
  const [recurrence, setRecurrence] = useState<Recurrence>(
    initialData?.recurrence || { enabled: false, intervalMonths: 12, warningPeriodDays: 30 }
  );
  
  // Periodic Review & Lifecycle Dates
  const [periodicReviewCycle, setPeriodicReviewCycle] = useState<number>(initialData?.periodicReviewCycle || 24);
  const [periodicReviewNotification, setPeriodicReviewNotification] = useState<number>(initialData?.periodicReviewNotification || 30);
  const [effectiveDate, setEffectiveDate] = useState<string>(initialData?.effectiveDate || "");
  const [validUntil, setValidUntil] = useState<string>(initialData?.validUntil || "");
  const [reviewDate, setReviewDate] = useState<string>(initialData?.reviewDate || "");

  // Evidence upload
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);

  // Training Materials
  const [trainingFiles, setTrainingFiles] = useState<TrainingFile[]>(initialData?.trainingFiles || []);
  const [instruction, setInstruction] = useState(initialData?.instruction || "");

  // Quiz Configuration
  const [hasQuiz, setHasQuiz] = useState(false);
  const [config, setConfig] = useState<TrainingConfig>(initialData?.config || {
    trainingType: "test_certification",
    passingScore: 7,
    maxAttempts: 3,
    trainingPeriodDays: 7,
    distributionList: [],
    questions: [],
  });

  // Assessment Config (Quiz Paper-based/Manual)
  const [examTemplate, setExamTemplate] = useState<UploadedFile | null>(null);
  const [answerKey, setAnswerKey] = useState<UploadedFile | null>(null);
  const [createdAt, setCreatedAt] = useState("");
  const [assessmentPassingGradeType, setAssessmentPassingGradeType] = useState<"pass_fail" | "score_10" | "percentage">("score_10");
  const [assessmentPassingScore, setAssessmentPassingScore] = useState(7);
  const [assessmentMaxAttempts, setAssessmentMaxAttempts] = useState(3);

  const [reviewers, setReviewers] = useState<CourseReviewer[]>(initialData?.reviewers || []);
  const [approvers, setApprovers] = useState<CourseApprover[]>(initialData?.approvers || []);
  const [isReviewersModalOpen, setIsReviewersModalOpen] = useState(false);
  const [isApproversModalOpen, setIsApproversModalOpen] = useState(false);

  const courseTabs = useMemo<TabItem[]>(() => [
    { id: "basic-info", label: "Basic Information" },
    { id: "document-training", label: "Training Materials" },
    { id: "training-config", label: "Assessment Config" },
    { id: "reviewers", label: "Reviewers", count: reviewers.length },
    { id: "approvers", label: "Approvers", count: approvers.length },
    { id: "audit-trail", label: "Audit Trail" },
  ], [reviewers.length, approvers.length]);

  const canPersistCourse = mode === "create" ? canCreateCourses : canEditCourses;
  const showSubmitForReview =
    canSubmitCourses && isCourseSaved && reviewers.length > 0 && approvers.length > 0;

  const handleCancel = () => {
    setShowDiscardGuard(true);
  };

  const handleSave = async () => {
    // Validation
    if (!courseName.trim()) {
      setModalType("error");
      setModalTitle("Validation Error");
      setModalDescription("Please enter course name.");
      setModalConfirmText(undefined);
      setModalCancelText(undefined);
      setModalAction(null);
      setIsModalOpen(true);
      return;
    }

    if (!instructor.trim()) {
      setModalType("error");
      setModalTitle("Validation Error");
      setModalDescription("Please enter instructor name.");
      setModalConfirmText(undefined);
      setModalCancelText(undefined);
      setModalAction(null);
      setIsModalOpen(true);
      return;
    }

    if (!scheduledDate) {
      setModalType("error");
      setModalTitle("Validation Error");
      setModalDescription("Please select scheduled date.");
      setModalConfirmText(undefined);
      setModalCancelText(undefined);
      setModalAction(null);
      setIsModalOpen(true);
      return;
    }

    if (!trainingLocation.trim()) {
      setModalType("error");
      setModalTitle("Validation Error");
      setModalDescription("Please enter training location.");
      setModalConfirmText(undefined);
      setModalCancelText(undefined);
      setModalAction(null);
      setIsModalOpen(true);
      return;
    }

    setModalType("confirm");
    setModalTitle(mode === "edit" ? "Save Changes?" : "Save Course?");
    setModalDescription(
      mode === "edit" 
        ? "Are you sure you want to save the changes to this course?" 
        : "Are you sure you want to save this course and proceed to the next step?"
    );
    setModalConfirmText("Save & Next");
    setModalCancelText("Discard");
    setModalAction(() => async () => {
      await performSave();
    });
    setIsModalOpen(true);
  };

  const performSave = async () => {
    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      const courseDataToSave = {
        id: initialData?.id,
        courseId,
        courseName,
        description,
        trainingType,
        trainingMethod,
        instructorType,
        instructor,
        scheduledDate,
        duration,
        location: trainingLocation,
        capacity,
        linkedDocumentIds,
        recurrence,
        trainingFiles: trainingFiles.map(f => ({ name: f.name, size: f.size, type: f.type })),
        instruction,
        hasQuiz,
        config: hasQuiz ? config : undefined,
        periodicReviewCycle,
        periodicReviewNotification,
        effectiveDate,
        validUntil,
        reviewDate,
      };

      console.log("Saving Course Data:", courseDataToSave);

      setIsLoading(false);
      setIsCourseSaved(true);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Save failed:", error);
      setIsLoading(false);
      setModalType("error");
      setModalTitle("Save Failed");
      setModalDescription("An error occurred while saving the course. Please try again.");
      setModalConfirmText(undefined);
      setModalCancelText(undefined);
      setModalAction(null);
      setIsModalOpen(true);
    }
  };

  const handleSubmitForReview = async () => {
    const missingFields: string[] = [];

    if (!courseName.trim()) missingFields.push("Course Name");
    if (!instructor.trim()) missingFields.push("Instructor");
    if (!scheduledDate) missingFields.push("Scheduled Date");
    if (!trainingLocation.trim()) missingFields.push("Training Location");
    if (trainingFiles.length === 0) missingFields.push("Training Materials (tab: Training Materials)");

    if (trainingMethod === "Quiz (Paper-based/Manual)" || (hasQuiz && config.trainingType === "test_certification")) {
      if (!examTemplate && mode === "create") missingFields.push("Exam Template (tab: Assessment Config)");
      const passScore = mode === "edit" ? config.passingScore : assessmentPassingScore;
      const passGradeType = mode === "create" ? assessmentPassingGradeType : "score_10";
      const maxAtt = mode === "edit" ? config.maxAttempts : assessmentMaxAttempts;
      
      if (passGradeType !== "pass_fail" && passScore <= 0) {
        missingFields.push("Minimum Passing Score must be greater than 0 (tab: Assessment Config)");
      }
      if (maxAtt < 1) {
        missingFields.push("Max Attempts must be at least 1 (tab: Assessment Config)");
      }
    }

    if (missingFields.length > 0) {
      setModalType("error");
      setModalTitle("Cannot Submit for Review");
      setModalDescription(
        <span>
          The following required fields are missing:
          <ul className="mt-2 space-y-1 list-none">
            {missingFields.map(f => (
              <li key={f} className="flex items-center gap-1.5 text-red-600 text-sm">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </span>
      );
      setModalConfirmText(undefined);
      setModalCancelText(undefined);
      setModalAction(null);
      setIsModalOpen(true);
      return;
    }

    setShowESignModal(true);
  };

  const handleESignConfirm = async (reason: string) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (mode === "create") {
          const now = new Date();
          const dd = String(now.getDate()).padStart(2, "0");
          const MM = String(now.getMonth() + 1).padStart(2, "0");
          const yyyy = now.getFullYear();
          const HH = String(now.getHours()).padStart(2, "0");
          const mm = String(now.getMinutes()).padStart(2, "0");
          setCreatedAt(`${dd}/${MM}/${yyyy} ${HH}:${mm}`);
      }
      setModalType("success");
      setModalTitle("Submitted Successfully");
      setModalDescription("The course has been submitted for review and is now in Pending Review status.");
      setModalConfirmText(undefined);
      setModalCancelText(undefined);
      setModalAction(() => () => { navigateBack(navigate, location.state as any, ROUTES.TRAINING.COURSES_LIST); });
      setIsModalOpen(true);
      setShowESignModal(false);
    } catch (error) {
      console.error("Submission failed:", error);
      setModalType("error");
      setModalTitle("Submission Failed");
      setModalDescription("An error occurred while submitting the course. Please try again.");
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddReviewers = (usersToAdd: MaterialWorkflowUser[]) => {
    const maxOrder = reviewers.length > 0 ? Math.max(...reviewers.map((r) => r.order)) : 0;
    const newReviewers: CourseReviewer[] = usersToAdd.map((user, idx) => ({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      position: user.position,
      email: user.email,
      department: user.department,
      order: maxOrder + idx + 1,
    }));
    setReviewers([...reviewers, ...newReviewers]);
  };

  const handleSelectApprover = (user: MaterialWorkflowUser) => {
    const newApprover: CourseApprover = {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      position: user.position,
      email: user.email,
      department: user.department,
    };
    setApprovers([newApprover]);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "basic-info":
        return (
          <BasicInfoTab
            courseId={courseId}
            createdAt={createdAt}
            courseName={courseName}
            setCourseName={setCourseName}
            description={description}
            setDescription={setDescription}
            trainingType={trainingType}
            setTrainingType={setTrainingType}
            trainingMethod={trainingMethod}
            setTrainingMethod={setTrainingMethod}
            instructorType={instructorType}
            setInstructorType={setInstructorType}
            instructor={instructor}
            setInstructor={setInstructor}
            scheduledDate={scheduledDate}
            setScheduledDate={setScheduledDate}
            duration={duration}
            setDuration={setDuration}
            location={trainingLocation}
            setLocation={setLocation}
            capacity={capacity}
            setCapacity={setCapacity}
            recurrence={recurrence}
            setRecurrence={setRecurrence}
            linkedDocumentIds={linkedDocumentIds}
            setLinkedDocumentIds={setLinkedDocumentIds}
            evidenceFiles={evidenceFiles}
            setEvidenceFiles={setEvidenceFiles}
            periodicReviewCycle={periodicReviewCycle}
            setPeriodicReviewCycle={setPeriodicReviewCycle}
            periodicReviewNotification={periodicReviewNotification}
            setPeriodicReviewNotification={setPeriodicReviewNotification}
            effectiveDate={effectiveDate}
            setEffectiveDate={setEffectiveDate}
            validUntil={validUntil}
            setValidUntil={setValidUntil}
            reviewDate={reviewDate}
            setReviewDate={setReviewDate}
          />
        );
      case "document-training":
        return (
          <DocumentTab
            trainingFiles={trainingFiles}
            setTrainingFiles={setTrainingFiles}
            instruction={instruction}
            setInstruction={setInstruction}
          />
        );
      case "training-config":
        return mode === "edit" ? (
          <ConfigTab trainingMethod={trainingMethod} />
        ) : (
          <ConfigTab
            trainingMethod={trainingMethod}
            examTemplate={examTemplate}
            setExamTemplate={setExamTemplate}
            answerKey={answerKey}
            setAnswerKey={setAnswerKey}
            passingGradeType={assessmentPassingGradeType}
            setPassingGradeType={setAssessmentPassingGradeType}
            passingScore={assessmentPassingScore}
            setPassingScore={setAssessmentPassingScore}
            maxAttempts={assessmentMaxAttempts}
            setMaxAttempts={setAssessmentMaxAttempts}
          />
        );
      case "reviewers":
        return (
          <CourseReviewersTab
            reviewers={reviewers}
            onReviewersChange={setReviewers}
            users={MATERIAL_WORKFLOW_USERS}
          />
        );
      case "approvers":
        return (
          <CourseApproversTab
            approvers={approvers}
            onApproversChange={setApprovers}
            users={MATERIAL_WORKFLOW_USERS}
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
      <PageHeader
        title={title}
        breadcrumbItems={breadcrumbItems}
        actions={
          <>
            <Button variant="outline-emerald" onClick={handleCancel} size="sm" className="whitespace-nowrap">
              Cancel
            </Button>
            <Button
              variant="outline-emerald"
              onClick={handleSave}
              size="sm"
              className="whitespace-nowrap"
              disabled={isLoading}
              hidden={!canPersistCourse}
            >
              {isLoading ? <ButtonLoading text="Saving..." /> : (mode === "edit" ? "Save Changes" : "Save")}
            </Button>
            {showSubmitForReview && (
              <Button
                variant="outline-emerald"
                onClick={handleSubmitForReview}
                size="sm"
                className="whitespace-nowrap"
                disabled={isLoading}
              >
                Submit for Review
              </Button>
            )}
          </>
        }
      />

      {mode === "edit" && initialData && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-5 flex items-start gap-3">
          <div>
            <p className="text-sm font-medium text-blue-800">
              Editing: {initialData.trainingId} — {initialData.courseName}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              Changes will create a new revision. The course will need re-approval if the training method or assessment config is modified.
            </p>
          </div>
        </div>
      )}

      <WorkflowStepper steps={WORKFLOW_STEPS} currentStepIndex={mode === "edit" && initialData ? initialData.workflowStep : 0} />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <TabNav tabs={courseTabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabType)} />
        <div className="animate-in fade-in duration-200">{renderTabContent()}</div>
      </div>

      <div className="flex flex-wrap justify-start gap-2">
        <Button variant="outline-emerald" onClick={handleCancel} size="sm" className="whitespace-nowrap">
          Cancel
        </Button>
        <Button
          variant="outline-emerald"
          onClick={handleSave}
          size="sm"
          className="whitespace-nowrap"
          disabled={isLoading}
          hidden={!canPersistCourse}
        >
          {isLoading ? <ButtonLoading text="Saving..." /> : (mode === "edit" ? "Save Changes" : "Save")}
        </Button>

        {showSubmitForReview && (
          <Button
            variant="outline-emerald"
            onClick={handleSubmitForReview}
            size="sm"
            className="whitespace-nowrap"
            disabled={isLoading}
          >
            Submit for Review
          </Button>
        )}

        {canPersistCourse && isCourseSaved && (
          <>
            <div className="w-px h-8 bg-slate-500 mx-1 hidden md:block"></div>
            <Button
              variant="outline-emerald"
              onClick={() => setIsReviewersModalOpen(true)}
              size="sm"
              className="whitespace-nowrap"
            >
              Reviewers
            </Button>
            <Button
              variant="outline-emerald"
              onClick={() => setIsApproversModalOpen(true)}
              size="sm"
              className="whitespace-nowrap"
            >
              Approvers
            </Button>
          </>
        )}
      </div>

      <AlertModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={modalAction ? () => { modalAction(); } : undefined}
        type={modalType}
        title={modalTitle}
        description={modalDescription}
        isLoading={isLoading}
        confirmText={modalConfirmText || (modalType === "success" ? "OK" : modalType === "confirm" ? "Confirm" : undefined)}
        cancelText={modalCancelText || "Cancel"}
      />

      <NavigationGuardModal
        isOpen={showDiscardGuard}
        onClose={() => setShowDiscardGuard(false)}
        onConfirm={() => navigateBack(navigate, location.state as any, ROUTES.TRAINING.COURSES_LIST)}
        mode="discard"
        currentPageTitle="Course Editor"
        title="Discard Changes?"
        primaryActionLabel="Discard"
        secondaryActionLabel="Keep editing"
        description="Are you sure you want to cancel? All unsaved changes will be lost."
      />

      <ESignatureModal
        isOpen={showESignModal}
        onClose={() => setShowESignModal(false)}
        onConfirm={(data) => handleESignConfirm(data.reason)}
        actionTitle="Submit Course for Review"
      />
      <ReviewerSelectionModal
        isOpen={isReviewersModalOpen}
        onClose={() => setIsReviewersModalOpen(false)}
        onConfirm={handleAddReviewers}
        existingIds={reviewers.map((r) => r.id)}
        users={MATERIAL_WORKFLOW_USERS}
      />

      <ApproverSelectionModal
        isOpen={isApproversModalOpen}
        onClose={() => setIsApproversModalOpen(false)}
        onSelect={handleSelectApprover}
        users={MATERIAL_WORKFLOW_USERS}
      />

      {(isLoading || isNavigating) && <FullPageLoading text="Processing..." />}
    </div>
  );
};

export const CreateCourseView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <CourseEditorContent
      mode="create"
      title="Create New Course"
      breadcrumbItems={courseCreate(navigate, location.state?.from)}
    />
  );
};

export const EditCourseView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId } = useParams<{ courseId: string }>();

  // In real app, fetch course data by courseId
  const initialData = (MOCK_COURSES.find((c) => c.id === courseId) ||
    (MOCK_TRAININGS.find((t) => t.id === courseId) as any))
    || MOCK_COURSE_DATA;

  return (
    <CourseEditorContent
      mode="edit"
      initialData={initialData}
      title="Edit Course"
      breadcrumbItems={courseEdit(navigate, location.state?.from)}
    />
  );
};
