import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { cn } from "@/components/ui/utils";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { materialReview } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { AlertModal, AlertModalType } from "@/components/ui/modal/AlertModal";
import { ESignatureModal } from "@/components/ui/esign-modal";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import {
  type TrainingMaterialWorkflow as TrainingMaterial,
  WORKFLOW_STEPS,
} from "@/features/training/materials/types";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { MOCK_MATERIAL_REVIEW } from "../mockData";
import { MaterialAuditTrailTab } from "../components/MaterialAuditTrailTab";
import { MaterialReviewersTab } from "../components/MaterialReviewersTab";
import { MaterialApproversTab } from "../components/MaterialApproversTab";
import { MaterialInfoReadOnly } from "../components/MaterialInformationTab";
import { MaterialReadOnlyUploadTab } from "../components/MaterialUploadTab";


import type { Reviewer } from "@/features/documents/document-list/document-creation/new-tabs/subtabs/types";
import type { Approver } from "@/features/documents/document-list/document-creation/new-tabs/subtabs/types";
import {
  buildInitialReviewers,
  buildInitialApprovers,
  useMaterialWorkflowUsers,
} from "./materialWorkflowUsers";
import { useTrainingPermissions } from "@/features/training/useTrainingPermissions";

// ─── Constants ─────────────────────────────────────────────────────
const TAB_IDS = {
  materialInformation: "material-information",
  fileUpload: "file-upload",
  reviewers: "reviewers",
  approvers: "approvers",
  auditTrail: "audit-trail",
} as const;


// ─── Component ─────────────────────────────────────────────────────
export const MaterialReviewView: React.FC = () => {
  const navigate = useNavigate();
  const workflowUsers = useMaterialWorkflowUsers();
  const { canReviewTrainingMaterials } = useTrainingPermissions();

  const [material, setMaterial] = useState<TrainingMaterial>(MOCK_MATERIAL_REVIEW);
  const [activeTab, setActiveTab] = useState<string>(TAB_IDS.fileUpload);
  const currentStepIndex = WORKFLOW_STEPS.indexOf(material.status);

  const reviewers = useMemo(
    () => buildInitialReviewers(material.reviewer, material.department, workflowUsers),
    [material.reviewer, material.department, workflowUsers]
  );
  const approvers = useMemo(
    () => buildInitialApprovers(material.approver, material.department, workflowUsers),
    [material.approver, material.department, workflowUsers]
  );

  const materialTabs = useMemo<TabItem[]>(
    () => [
      { id: TAB_IDS.fileUpload, label: "File Upload" },
      { id: TAB_IDS.materialInformation, label: "Material Information" },
      { id: TAB_IDS.reviewers, label: "Reviewers" },
      { id: TAB_IDS.approvers, label: "Approvers" },
      { id: TAB_IDS.auditTrail, label: "Audit Trail" },
    ],
    []
  );


  const canReview =
    material.status === "Pending Review" && canReviewTrainingMaterials;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<AlertModalType>("info");
  const [modalTitle, setModalTitle] = useState("");
  const [modalDescription, setModalDescription] = useState("");
  const [modalAction, setModalAction] = useState<(() => void) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNavigateBack = () => {
    setIsNavigating(true);
    setTimeout(() => navigateBack(navigate, null, ROUTES.TRAINING.MATERIALS), 600);
  };

  const [showESignModal, setShowESignModal] = useState(false);
  const [eSignAction, setESignAction] = useState<"approve" | "reject" | null>(null);

  const handleApproveReview = () => { setESignAction("approve"); setShowESignModal(true); };
  const handleRejectReview = () => { setESignAction("reject"); setShowESignModal(true); };

  const getESignTitle = () => {
    switch (eSignAction) {
      case "approve": return "Complete Review & Pass to Approval";
      case "reject": return "Reject Material (Review)";
      default: return "";
    }
  };

  const handleESignConfirm = async (reason: string) => {
    setIsLoading(true);
    try {
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
      switch (eSignAction) {
        case "approve":
          setMaterial((prev) => ({
            ...prev,
            status: "Pending Approval",
            reviewedAt: new Date().toISOString().split("T")[0],
            reviewComment: reason,
          }));
          setModalType("success");
          setModalTitle("Review Completed");
          setModalDescription("Material has been reviewed and is now pending final approval.");
          setModalAction(null);
          break;
        case "reject":
          setMaterial((prev) => ({ ...prev, status: "Draft", reviewComment: reason }));
          setModalType("success");
          setModalTitle("Material Rejected");
          setModalDescription("Material has been rejected and returned to Draft. The author will be notified.");
          setModalAction(() => () => navigate(ROUTES.TRAINING.MATERIALS));
          break;
      }
      setESignAction(null);
      setIsModalOpen(true);
      setShowESignModal(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <PageHeader
        title="Review Material"
        breadcrumbItems={materialReview(navigate)}
        actions={
          <>
            <Button variant="outline-emerald" size="sm" className="whitespace-nowrap" onClick={handleNavigateBack}>
              Back
            </Button>
            {canReview && (
              <>
                <Button variant="outline-emerald" size="sm" className="whitespace-nowrap" onClick={handleRejectReview}>
                  Reject
                </Button>
                <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={handleApproveReview}>
                  Complete Review
                </Button>
              </>
            )}
          </>
        }
      />

      {/* ─── Workflow Stepper ───────────────────────────────────── */}
      <WorkflowStepper steps={WORKFLOW_STEPS} currentStepIndex={currentStepIndex} />

      {/* ─── Card: Tabs + Content ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={materialTabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="p-4 md:p-5">
          <div className={cn(activeTab !== TAB_IDS.materialInformation && "hidden")}>
            <MaterialInfoReadOnly material={material} />
          </div>

          <div className={cn(activeTab !== TAB_IDS.fileUpload && "hidden")}>
            <MaterialReadOnlyUploadTab material={material} />
          </div>


          <div className={cn(activeTab !== TAB_IDS.reviewers && "hidden")}>
            <MaterialReviewersTab
              reviewers={reviewers}
              onReviewersChange={() => { }}
              isModalOpen={false}
              onModalClose={() => { }}
              users={workflowUsers}
              readOnly
            />
          </div>

          <div className={cn(activeTab !== TAB_IDS.approvers && "hidden")}>
            <MaterialApproversTab
              approvers={approvers}
              onApproversChange={() => { }}
              isModalOpen={false}
              onModalClose={() => { }}
              users={workflowUsers}
              readOnly
            />
          </div>

          <div className={cn(activeTab !== TAB_IDS.auditTrail && "hidden")}>
            <MaterialAuditTrailTab />
          </div>
        </div>
      </div>

      {/* ─── Bottom Actions ──────────────────────────────────────── */}
      <div className="flex flex-wrap justify-start gap-2">
        <Button variant="outline-emerald" size="sm" className="whitespace-nowrap" onClick={handleNavigateBack}>
          Back
        </Button>
        {canReview && (
          <>
            <Button variant="outline-emerald" size="sm" className="whitespace-nowrap" onClick={handleRejectReview}>
              Reject
            </Button>
            <Button variant="outline-emerald" size="sm" className="whitespace-nowrap" onClick={handleApproveReview}>
              Complete Review
            </Button>
          </>
        )}
      </div>

      <AlertModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={modalAction ? () => { setIsNavigating(true); setTimeout(() => { modalAction(); setIsModalOpen(false); }, 600); } : undefined}
        type={modalType}
        title={modalTitle}
        description={modalDescription}
        isLoading={isLoading}
        confirmText={modalType === "success" ? "OK" : modalType === "confirm" ? "Confirm" : undefined}
      />

      <ESignatureModal
        isOpen={showESignModal}
        onClose={() => { setShowESignModal(false); setESignAction(null); }}
        onConfirm={handleESignConfirm}
        actionTitle={getESignTitle()}
      />

      {(isLoading || isNavigating) && <FullPageLoading text="Processing..." />}
    </div>
  );
};
