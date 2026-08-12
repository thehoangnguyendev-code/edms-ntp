import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { cn } from "@/components/ui/utils";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { materialDetail } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
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

// ─── Constants ─────────────────────────────────────────────────────
const TAB_IDS = {
  materialInformation: "material-information",
  fileUpload: "file-upload",
  reviewers: "reviewers",
  approvers: "approvers",
  auditTrail: "audit-trail",
} as const;


// ─── Component ─────────────────────────────────────────────────────
export const MaterialDetailView: React.FC = () => {
  const navigate = useNavigate();
  const workflowUsers = useMaterialWorkflowUsers();
  const location = useLocation();

  const [material] = useState<TrainingMaterial>(MOCK_MATERIAL_REVIEW);
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


  const [isNavigating, setIsNavigating] = useState(false);

  const handleNavigateBack = () => {
    setIsNavigating(true);
    const fallbackRoute = location.state?.from
      ? `${ROUTES.TRAINING.MATERIALS}${location.state.from}`
      : ROUTES.TRAINING.MATERIALS;
    setTimeout(() => navigateBack(navigate, location.state as any, fallbackRoute), 600);
  };

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <PageHeader
        title="Material Detail"
        breadcrumbItems={materialDetail(navigate, location.state?.from)}
        actions={
          <Button variant="outline-emerald" size="sm" className="whitespace-nowrap" onClick={handleNavigateBack}>
            Back
          </Button>
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
      </div>

      {isNavigating && <FullPageLoading text="Loading..." />}
    </div>
  );
};
