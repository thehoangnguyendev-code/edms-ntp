import React, { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CloudUpload,
  FileImage,
  FileText,
  GitBranch,
  Info,
  Link2,
  Lock,
  Video,
  X,
} from "lucide-react";
import { IconRefresh } from "@tabler/icons-react";
import { cn } from "@/components/ui/utils";
import { Progress } from "@/components/ui";
import { FormSection } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { materialNewRevision } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { ButtonLoading, FullPageLoading } from "@/components/ui/loading/Loading";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Select } from "@/components/ui/select/Select";
import { AlertModal, type AlertModalType } from "@/components/ui/modal/AlertModal";
import { NavigationGuardModal } from "@/components/ui/modal/NavigationGuardModal";
import { ESignatureModal } from "@/components/ui/esign-modal";
import { getFileIconSrc } from "@/utils/fileIcons";
import { BUSINESS_UNIT_DEPARTMENTS } from "@/features/security-authorization/user-management/constants";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import {
  type MaterialStatus,
  type MaterialRevisionFormData,
  type MaterialUploadMode,
  type MaterialUploadedFile,
  WORKFLOW_STEPS,
} from "@/features/training/materials/types";
import { MaterialAuditTrailTab } from "../components/MaterialAuditTrailTab";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import type {
  Approver,
  Reviewer,
} from "@/features/documents/document-list/document-creation/new-tabs/subtabs/types";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import {
  buildInitialApprovers,
  buildInitialReviewers,
  useMaterialWorkflowUsers,
} from "./materialWorkflowUsers";
import { useTrainingPermissions } from "@/features/training/useTrainingPermissions";
import { MaterialRevisionInformationTab } from "../components/MaterialInformationTab";
import { MaterialRevisionUploadTab } from "../components/MaterialUploadTab";


import { MaterialReviewersTab } from "../components/MaterialReviewersTab";
import { MaterialApproversTab } from "../components/MaterialApproversTab";

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".mp4",
  ".jpg",
  ".jpeg",
  ".png",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
];
const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const TAB_IDS = {
  materialInformation: "material-information",
  fileUpload: "file-upload",
  reviewers: "reviewers",
  approvers: "approvers",
  auditTrail: "audit-trail",
} as const;


const BUSINESS_UNIT_OPTIONS = [
  { label: "Select Business Unit", value: "" },
  ...Object.keys(BUSINESS_UNIT_DEPARTMENTS).map((businessUnit) => ({
    label: businessUnit,
    value: businessUnit,
  })),
];

interface SourceMaterial {
  status: MaterialStatus;
  uploadMode: MaterialUploadMode;
  existingFile: { name: string; size: number };
  form: Omit<MaterialRevisionFormData, "revisionNotes" | "externalUrl">;
}

const MOCK_MATERIAL_SOURCE: Record<string, SourceMaterial> = {
  "1": {
    status: "Effective",
    uploadMode: "file",
    existingFile: { name: "GMP_Introduction_2026.mp4", size: 131072000 },
    form: {
      materialName: "GMP Introduction Video",
      materialNumber: "TM-VID-001",
      version: "2.1",
      author: "John Doe",
      businessUnit: "Quality",
      department: "Quality Assurance",
      reviewer: "j.wilson",
      approver: "a.smith",
      description: "Comprehensive overview of Good Manufacturing Practices",
      periodicReviewCycle: 24,
      periodicReviewNotification: 30,
      effectiveDate: "2026-01-10",
      validUntil: "2028-01-10",
      reviewDate: "2027-12-10",
    },
  },
  "2": {
    status: "Effective",
    uploadMode: "file",
    existingFile: { name: "Cleanroom_Operations_Manual_v3.pdf", size: 4718592 },
    form: {
      materialName: "Cleanroom Operations Manual",
      materialNumber: "TM-PDF-002",
      version: "3.0",
      author: "Jane Smith",
      businessUnit: "Production",
      department: "Production",
      reviewer: "s.johnson",
      approver: "binh.tt",
      description: "Step-by-step guide for cleanroom operations and procedures",
      periodicReviewCycle: 24,
      periodicReviewNotification: 30,
      effectiveDate: "2026-02-20",
      validUntil: "2028-02-20",
      reviewDate: "2028-01-20",
    },
  },
  "4": {
    status: "Effective",
    uploadMode: "file",
    existingFile: { name: "Safety_Protocol_Infographic.png", size: 2202009 },
    form: {
      materialName: "Safety Protocol Infographic",
      materialNumber: "TM-IMG-004",
      version: "1.0",
      author: "Sarah Williams",
      businessUnit: "HSE",
      department: "HSE",
      reviewer: "an.nv",
      approver: "binh.tt",
      description: "Key safety protocols illustrated for quick reference",
      periodicReviewCycle: 24,
      periodicReviewNotification: 30,
      effectiveDate: "2026-03-15",
      validUntil: "2028-03-15",
      reviewDate: "2028-02-15",
    },
  },
  "5": {
    status: "Draft",
    uploadMode: "file",
    existingFile: { name: "ISO9001_Training_2026.mp4", size: 220200960 },
    form: {
      materialName: "ISO 9001 Training Video",
      materialNumber: "TM-VID-005",
      version: "4.2",
      author: "Robert Brown",
      businessUnit: "Quality",
      department: "Quality Assurance",
      reviewer: "j.doe, m.brown",
      approver: "a.smith",
      description: "Understanding ISO 9001:2015 requirements and implementation",
      periodicReviewCycle: 24,
      periodicReviewNotification: 30,
      effectiveDate: "2026-04-10",
      validUntil: "2028-04-10",
      reviewDate: "2028-03-10",
    },
  },
  "6": {
    status: "Effective",
    uploadMode: "file",
    existingFile: { name: "SOP_Template_Pack_v2.docx", size: 1048576 },
    form: {
      materialName: "SOP Template Pack",
      materialNumber: "TM-DOC-006",
      version: "2.0",
      author: "Emily Davis",
      businessUnit: "Quality",
      department: "Quality Control",
      reviewer: "e.chen",
      approver: "a.smith",
      description: "Standard Operating Procedure templates for documentation",
      periodicReviewCycle: 24,
      periodicReviewNotification: 30,
      effectiveDate: "2026-05-05",
      validUntil: "2028-05-05",
      reviewDate: "2028-04-05",
    },
  },
  "9": {
    status: "Effective",
    uploadMode: "file",
    existingFile: { name: "Deviation_Investigation_Training.mp4", size: 188743680 },
    form: {
      materialName: "Deviation Investigation Training",
      materialNumber: "TM-VID-009",
      version: "1.0",
      author: "Michael Chen",
      businessUnit: "Quality",
      department: "Quality Assurance",
      reviewer: "an.nv",
      approver: "a.smith",
      description: "How to investigate and document process deviations",
      periodicReviewCycle: 24,
      periodicReviewNotification: 30,
      effectiveDate: "2026-06-20",
      validUntil: "2028-06-20",
      reviewDate: "2028-05-20",
    },
  },
};

const parseVersion = (version: string): { major: number; minor: number } => {
  const parts = version.split(".");
  return {
    major: parseInt(parts[0] ?? "1", 10) || 1,
    minor: parseInt(parts[1] ?? "0", 10) || 0,
  };
};

const suggestVersion = (current: string, type: "major" | "minor"): string => {
  const { major, minor } = parseVersion(current);
  if (type === "major") return `${major + 1}.0`;
  return `${major}.${minor + 1}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const getFileTypeLabel = (name: string) => {
  const ext = name.toLowerCase().split(".").pop();
  switch (ext) {
    case "pdf":
      return "PDF";
    case "mp4":
      return "Video";
    case "jpg":
    case "jpeg":
    case "png":
      return "Image";
    default:
      return "Document";
  }
};

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const NewRevisionForm: React.FC<{ source: SourceMaterial }> = ({ source }) => {
  const navigate = useNavigate();
  const { canEditTrainingMaterials, canSubmitTrainingMaterials } =
    useTrainingPermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workflowUsers = useMaterialWorkflowUsers();

  const [activeTab, setActiveTab] = useState<string>(TAB_IDS.fileUpload);
  const [formData, setFormData] = useState<MaterialRevisionFormData>({
    ...source.form,
    version: suggestVersion(source.form.version, "major"),
    revisionNotes: "",
    externalUrl: "",
    periodicReviewCycle: source.form.periodicReviewCycle || 24,
    periodicReviewNotification: source.form.periodicReviewNotification || 30,
    effectiveDate: source.form.effectiveDate || "",
    validUntil: source.form.validUntil || "",
    reviewDate: source.form.reviewDate || "",
  });
  const [uploadMode, setUploadMode] = useState<MaterialUploadMode>(source.uploadMode);
  const [isDragActive, setIsDragActive] = useState(false);
  const [keepExistingFile, setKeepExistingFile] = useState(true);
  const [newFile, setNewFile] = useState<MaterialUploadedFile | null>(null);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [isReviewerModalOpen, setIsReviewerModalOpen] = useState(false);
  const [isApproverModalOpen, setIsApproverModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDiscardGuard, setShowDiscardGuard] = useState(false);
  const [modalType, setModalType] = useState<AlertModalType>("info");
  const [modalTitle, setModalTitle] = useState("");
  const [modalDescription, setModalDescription] = useState<React.ReactNode>("");
  const [modalAction, setModalAction] = useState<(() => void | Promise<void>) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showESignModal, setShowESignModal] = useState(false);
  const [createdTime, setCreatedTime] = useState("");

  React.useEffect(() => {
    setReviewers(buildInitialReviewers(source.form.reviewer, source.form.department, workflowUsers));
    setApprovers(buildInitialApprovers(source.form.approver, source.form.department, workflowUsers));
  }, [source.form.reviewer, source.form.department, source.form.approver, workflowUsers]);

  const departmentOptions = useMemo(() => {
    if (!formData.businessUnit) {
      return [{ label: "Select Department", value: "" }];
    }
    const departments = BUSINESS_UNIT_DEPARTMENTS[formData.businessUnit] || [];
    return [
      { label: "Select Department", value: "" },
      ...departments.map((department) => ({ label: department, value: department })),
    ];
  }, [formData.businessUnit]);

  const updateField = useCallback(
    <K extends keyof MaterialRevisionFormData>(key: K, value: MaterialRevisionFormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const tabs = useMemo<TabItem[]>(() => [
    { id: TAB_IDS.fileUpload, label: "File Upload" },
    { id: TAB_IDS.materialInformation, label: "Material Information" },
    { id: TAB_IDS.reviewers, label: "Reviewers", count: reviewers.length },
    { id: TAB_IDS.approvers, label: "Approvers", count: approvers.length },
    { id: TAB_IDS.auditTrail, label: "Audit Trail" },
  ], [reviewers.length, approvers.length]);


  const uploadTabs = useMemo<TabItem[]>(() => [
    { id: "file", label: "Upload File", icon: CloudUpload },
    { id: "link", label: "Paste Link", icon: Link2 },
  ], []);

  const handleReviewersChange = useCallback((nextReviewers: Reviewer[]) => {
    setReviewers(nextReviewers);
    updateField("reviewer", nextReviewers.map((reviewer) => reviewer.username).join(", "));
  }, [updateField]);

  const handleApproversChange = useCallback((nextApprovers: Approver[]) => {
    setApprovers(nextApprovers);
    updateField("approver", nextApprovers[0]?.username ?? "");
  }, [updateField]);

  const validateFile = (file: File): string | null => {
    const ext = `.${file.name.toLowerCase().split(".").pop()}`;
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return `Invalid format. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File exceeds ${MAX_FILE_SIZE_MB}MB limit.`;
    }
    return null;
  };

  const simulateUpload = (file: File) => {
    const entry: MaterialUploadedFile = {
      id: Date.now().toString(),
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
    };
    setNewFile(entry);
    let progress = 0;
    const interval = setInterval(() => {
      // Slower progress: 5-15% per tick
      progress += Math.random() * 10 + 5;
      
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // First show 100%
        setNewFile((prev) => prev ? { ...prev, progress: 100 } : null);

        // Small delay before setting success status (which hides the bar)
        setTimeout(() => {
          setNewFile((prev) => prev ? { ...prev, status: "success" } : null);
        }, 600);
      } else {
        setNewFile((prev) => prev ? { ...prev, progress: Math.round(progress) } : null);
      }
    }, 400);
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const error = validateFile(files[0]);
    if (error) {
      setModalType("error");
      setModalTitle("File Error");
      setModalDescription(error);
      setModalAction(null);
      setIsModalOpen(true);
      return;
    }
    simulateUpload(files[0]);
    setKeepExistingFile(false);
  };

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
    handleFileSelect(event.dataTransfer.files);
  }, []);

  const validateForm = (): string[] | null => {
    const errors: string[] = [];
    if (uploadMode === "link") {
      if (!formData.externalUrl.trim()) {
        errors.push("External resource URL is required.");
      } else if (!isValidUrl(formData.externalUrl)) {
        errors.push("The external URL provided is invalid.");
      }
    }

    if (!formData.materialName.trim()) {
      errors.push("Material Name is required.");
    }

    if (!formData.businessUnit) {
      errors.push("Business Unit selection is required.");
    }

    if (!formData.department) {
      errors.push("Department selection is required.");
    }

    // Periodic Review Fields
    if (!formData.periodicReviewCycle || formData.periodicReviewCycle <= 0) {
      errors.push("Periodic Review Cycle (Months) is required and must be greater than 0.");
    }

    if (!formData.periodicReviewNotification || formData.periodicReviewNotification <= 0) {
      errors.push("Periodic Review Notification (Days) is required and must be greater than 0.");
    }

    if (reviewers.length === 0) {
      errors.push("At least one Reviewer must be assigned.");
    }

    if (approvers.length === 0) {
      errors.push("At least one Approver must be assigned.");
    }

    if (!formData.description.trim()) {
      errors.push("Material Description is required.");
    }

    return errors.length > 0 ? errors : null;
  };

  const handleSave = () => {
    const errors = validateForm();
    if (errors) {
      setModalType("error");
      setModalTitle("Incomplete Revision Data");
      setModalDescription(
        <div className="space-y-2">
          <p>Please provide the following required information before saving the revision:</p>
          <ul className="list-disc list-inside text-xs text-slate-500 space-y-1">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      );
      setModalAction(null);
      setIsModalOpen(true);
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setModalType("success");
      setModalTitle("Revision Saved");
      setModalDescription(`New revision ${formData.version} of ${formData.materialNumber} has been saved.`);
      setModalAction(() => () => navigate(ROUTES.TRAINING.MATERIALS));
      setIsModalOpen(true);
    }, 1000);
  };

  const handleSubmitForReview = () => {
    const errors = validateForm();
    if (errors) {
      setModalType("error");
      setModalTitle("Cannot Submit Revision");
      setModalDescription(
        <div className="space-y-2">
          <p>The following requirements must be met before submitting the revision:</p>
          <ul className="list-disc list-inside text-xs text-slate-500 space-y-1">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      );
      setModalAction(null);
      setIsModalOpen(true);
      return;
    }
    setShowESignModal(true);
  };

  const formatDateTime = useCallback((date: Date): string => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }, []);

  const handleESignConfirm = (_reason: string) => {
    setShowESignModal(false);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setCreatedTime(formatDateTime(new Date()));
      setModalType("success");
      setModalTitle("Revision Submitted for Review");
      setModalDescription(`Revision ${formData.version} of ${formData.materialNumber} has been submitted for review.`);
      setModalAction(() => () => navigate(ROUTES.TRAINING.MATERIALS));
      setIsModalOpen(true);
    }, 1000);
  };

  const handleCancel = () => {
    setShowDiscardGuard(true);
  };

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">

      <PageHeader
        title="Upgrade Material Revision"
        breadcrumbItems={materialNewRevision(navigate)}
        actions={(
          <>
            <Button variant="outline-emerald" size="sm" onClick={handleCancel} className="whitespace-nowrap">Cancel</Button>
            {canEditTrainingMaterials && (
              <Button variant="outline-emerald" size="sm" onClick={handleSave} disabled={isLoading} className="whitespace-nowrap">{isLoading ? <ButtonLoading text="Saving..." /> : "Save"}</Button>
            )}
            {canSubmitTrainingMaterials && (
              <Button variant="outline-emerald" size="sm" onClick={handleSubmitForReview} disabled={isLoading} className="whitespace-nowrap">Submit for Review</Button>
            )}
          </>
        )}
      />

      <WorkflowStepper steps={WORKFLOW_STEPS} currentStepIndex={0} />

      <div className="flex items-start gap-3 p-4 md:p-5 bg-blue-50 border border-blue-200 rounded-xl">
        <GitBranch className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-blue-800">Major Revision - upgrading from an existing material</p>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200">
                v{source.form.version}
              </span>
              <span className="text-blue-400">→</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 border border-amber-200">
                v{suggestVersion(source.form.version, "major")}
              </span>
            </div>
          </div>
          <p className="text-xs text-blue-700 mt-0.5">
            {source.form.materialName} · {source.form.materialNumber}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            New revision will be saved as <span className="font-semibold">Draft</span> and must go through the approval workflow before becoming effective.
          </p>
        </div>
      </div>

      <WarningBanner
        variant="warning"
        description={
          <p>
            <span className="font-bold text-amber-900">Current version remains Effective</span> until the new revision completes the approval workflow and is published. Linked courses will continue using <span className="font-semibold">v{source.form.version}</span> in the meantime. Once the new version is Effective, all linked courses will automatically transition to <span className="font-bold text-amber-800">Obsoleted</span> status.
          </p>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="p-4 md:p-5">
          <div className={cn(activeTab !== TAB_IDS.materialInformation && "hidden")}> 
            <MaterialRevisionInformationTab
              formData={formData}
              updateField={updateField}
              departmentOptions={departmentOptions}
              businessUnitOptions={BUSINESS_UNIT_OPTIONS}
              createdTime={createdTime}
            />

          </div>

          <div className={cn(activeTab !== TAB_IDS.fileUpload && "hidden")}> 
            <MaterialRevisionUploadTab
              source={source}
              uploadMode={uploadMode}
              uploadTabs={uploadTabs}
              setUploadMode={setUploadMode}
              keepExistingFile={keepExistingFile}
              setKeepExistingFile={setKeepExistingFile}
              newFile={newFile}
              setNewFile={setNewFile}
              isDragActive={isDragActive}
              handleDragOver={handleDragOver}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              handleFileSelect={handleFileSelect}
              fileInputRef={fileInputRef}
              formData={formData}
              updateField={updateField}
              isValidUrl={isValidUrl}
              formatFileSize={formatFileSize}
              getFileTypeLabel={getFileTypeLabel}
            />
          </div>


          <div className={cn(activeTab !== TAB_IDS.reviewers && "hidden")}> 
            <MaterialReviewersTab
              reviewers={reviewers}
              onReviewersChange={handleReviewersChange}
              isModalOpen={isReviewerModalOpen}
              onModalClose={() => setIsReviewerModalOpen(false)}
              users={workflowUsers}
            />
          </div>

          <div className={cn(activeTab !== TAB_IDS.approvers && "hidden")}> 
            <MaterialApproversTab
              approvers={approvers}
              onApproversChange={handleApproversChange}
              isModalOpen={isApproverModalOpen}
              onModalClose={() => setIsApproverModalOpen(false)}
              users={workflowUsers}
            />
          </div>

          <div className={cn(activeTab !== TAB_IDS.auditTrail && "hidden")}> 
            <MaterialAuditTrailTab />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-start gap-2">
        <Button variant="outline-emerald" size="sm" onClick={handleCancel} className="whitespace-nowrap">Cancel</Button>
        {canEditTrainingMaterials && (
          <Button variant="outline-emerald" size="sm" onClick={handleSave} disabled={isLoading} className="whitespace-nowrap">{isLoading ? <ButtonLoading text="Saving..." /> : "Save"}</Button>
        )}
        {canSubmitTrainingMaterials && (
          <Button variant="outline-emerald" size="sm" onClick={handleSubmitForReview} disabled={isLoading} className="whitespace-nowrap">Submit for Review</Button>
        )}
        {canEditTrainingMaterials && (
          <>
            <div className="w-px h-8 bg-slate-500 mx-1"></div>
            <Button variant="outline-emerald" size="sm" onClick={() => { setActiveTab(TAB_IDS.reviewers); setIsReviewerModalOpen(true); }} className="whitespace-nowrap">Reviewers</Button>
            <Button variant="outline-emerald" size="sm" onClick={() => { setActiveTab(TAB_IDS.approvers); setIsApproverModalOpen(true); }} className="whitespace-nowrap">Approvers</Button>
          </>
        )}
      </div>

      <AlertModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={modalAction ? () => {
          setIsNavigating(true);
          setTimeout(() => {
            modalAction();
            setIsModalOpen(false);
          }, 600);
        } : undefined}
        type={modalType}
        title={modalTitle}
        description={modalDescription}
        isLoading={isLoading}
        confirmText={modalType === "success" ? "OK" : modalType === "confirm" ? "Discard" : undefined}
      />

      <NavigationGuardModal
        isOpen={showDiscardGuard}
        onClose={() => setShowDiscardGuard(false)}
        onConfirm={() => navigateBack(navigate, null, ROUTES.TRAINING.MATERIALS)}
        mode="discard"
        currentPageTitle="Upgrade Material Revision"
        title="Discard Upgrade Material Revision?"
        primaryActionLabel="Discard"
        secondaryActionLabel="Keep editing"
        description="Are you sure you want to cancel? All unsaved changes will be lost."
      />

      <ESignatureModal
        isOpen={showESignModal}
        onClose={() => setShowESignModal(false)}
        onConfirm={handleESignConfirm}
        actionTitle="Submit Material for Review"
      />

      {(isLoading || isNavigating) && <FullPageLoading text="Processing..." />}
    </div>
  );
};

export const NewRevisionView: React.FC = () => {
  const { materialId } = useParams<{ materialId: string }>();
  const navigate = useNavigate();
  const [isNavigatingOut, setIsNavigatingOut] = useState(false);

  const source = MOCK_MATERIAL_SOURCE[materialId ?? ""] ?? null;

  if (!source) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Material Not Found</h2>
        <p className="text-sm text-slate-500">The requested material could not be found.</p>
        <Button
          variant="outline-emerald"
          size="sm"
          onClick={() => {
            setIsNavigatingOut(true);
            setTimeout(() => navigateBack(navigate, null, ROUTES.TRAINING.MATERIALS), 600);
          }}
          className="whitespace-nowrap gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {isNavigatingOut && <FullPageLoading text="Loading..." />}
      </div>
    );
  }

  return <NewRevisionForm source={source} />;
};
