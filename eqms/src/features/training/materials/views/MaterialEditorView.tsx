import React, { useCallback, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CloudUpload,
  Link2,
  Lock,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { PageHeader } from "@/components/ui/page/PageHeader";
import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";
import {
  materialEdit,
  uploadMaterial,
} from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import {
  ButtonLoading,
  FullPageLoading,
} from "@/components/ui/loading/Loading";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { AlertModal, type AlertModalType } from "@/components/ui/modal/AlertModal";
import { NavigationGuardModal } from "@/components/ui/modal/NavigationGuardModal";
import { ESignatureModal } from "@/components/ui/esign-modal";
import { BUSINESS_UNIT_DEPARTMENTS } from "@/features/security-authorization/user-management/constants";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import {
  type MaterialStatus,
  type MaterialUploadMode,
  type MaterialUploadedFile,
  type MaterialWorkflowFormData,
  WORKFLOW_STEPS,
} from "@/features/training/materials/types";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import type {
  Approver,
  Reviewer,
} from "@/features/documents/document-list/document-creation/new-tabs/subtabs/types";
import {
  buildInitialApprovers,
  buildInitialReviewers,
  useMaterialWorkflowUsers,
} from "./materialWorkflowUsers";
import { MaterialAuditTrailTab } from "../components/MaterialAuditTrailTab";
import { MaterialEditorInformationTab } from "../components/MaterialInformationTab";
import { MaterialEditorUploadTab } from "../components/MaterialUploadTab";


import { MaterialReviewersTab } from "../components/MaterialReviewersTab";
import { MaterialApproversTab } from "../components/MaterialApproversTab";
import { useTrainingPermissions } from "@/features/training/useTrainingPermissions";
import { navigateBack } from "@/app/navigation/backNavigation";
import { ROUTES } from "@/app/routes.constants";

type MaterialEditorMode = "upload" | "edit";

type EditUploadedFile = MaterialUploadedFile & {
  status: MaterialUploadedFile["status"] | "existing";
};

interface ExistingMaterialData {
  status: MaterialStatus;
  form: MaterialWorkflowFormData;
  existingFile: { name: string; size: number };
  uploadMode: MaterialUploadMode;
}

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

export const MOCK_MATERIAL_DATA: Record<string, ExistingMaterialData> = {
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
      description:
        "Understanding ISO 9001:2015 requirements and implementation",
      externalUrl: "",
      periodicReviewCycle: 24,
      periodicReviewNotification: 30,
      effectiveDate: "2026-06-01",
      validUntil: "2028-06-01",
      reviewDate: "2028-05-01",
    },
  },
  "12": {
    status: "Draft",
    uploadMode: "file",
    existingFile: { name: "Water_System_Qualification.pdf", size: 12582912 },
    form: {
      materialName: "Water System Qualification",
      materialNumber: "TM-PDF-012",
      version: "2.0",
      author: "Jennifer Lee",
      businessUnit: "Engineering",
      department: "Engineering",
      reviewer: "d.martinez",
      approver: "binh.tt",
      description: "Procedures for water system IQ, OQ, and PQ",
      externalUrl: "",
      periodicReviewCycle: 24,
      periodicReviewNotification: 30,
      effectiveDate: "2026-07-15",
      validUntil: "2028-07-15",
      reviewDate: "2028-06-15",
    },
  },
};

const getFileTypeFromName = (
  name: string,
): "PDF" | "Video" | "Image" | "Document" => {
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

const generateMaterialNumber = (
  fileType: "PDF" | "Video" | "Image" | "Document",
): string => {
  const prefix: Record<string, string> = {
    PDF: "TM-PDF",
    Video: "TM-VID",
    Image: "TM-IMG",
    Document: "TM-DOC",
  };
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `${prefix[fileType]}-${randomNum}`;
};

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const buildDefaultFormData = (): MaterialWorkflowFormData => ({
  materialName: "",
  materialNumber: "",
  version: "1.0",
  author: "Dr. A. Smith",
  businessUnit: "",
  department: "",
  reviewer: "",
  approver: "",
  description: "",
  externalUrl: "",
  periodicReviewCycle: 24,
  periodicReviewNotification: 30,
  effectiveDate: "",
  validUntil: "",
  reviewDate: "",
});

interface MaterialEditorContentProps {
  mode: MaterialEditorMode;
  title: string;
  breadcrumbItems: BreadcrumbItem[];
  existingData?: ExistingMaterialData;
}

const MaterialEditorContent: React.FC<MaterialEditorContentProps> = ({
  mode,
  title,
  breadcrumbItems,
  existingData,
}) => {
  const navigate = useNavigate();
  const {
    canCreateTrainingMaterials,
    canEditTrainingMaterials,
    canSubmitTrainingMaterials,
  } = useTrainingPermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workflowUsers = useMaterialWorkflowUsers();

  const [activeTab, setActiveTab] = useState<string>(TAB_IDS.fileUpload);
  const [formData, setFormData] = useState<MaterialWorkflowFormData>(
    existingData?.form ?? buildDefaultFormData(),
  );
  const [uploadMode, setUploadMode] = useState<MaterialUploadMode>(
    existingData?.uploadMode ?? "file",
  );
  const [uploadedFile, setUploadedFile] = useState<MaterialUploadedFile | null>(null);
  const [newFile, setNewFile] = useState<EditUploadedFile | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isReplacingFile, setIsReplacingFile] = useState(false);
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
  const [modalConfirmText, setModalConfirmText] = useState<string | undefined>(undefined);
  const [modalCancelText, setModalCancelText] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showESignModal, setShowESignModal] = useState(false);
  const [createdTime, setCreatedTime] = useState("");
  const [isUploadSaved, setIsUploadSaved] = useState(mode === "edit");

  React.useEffect(() => {
    if (!existingData) {
      setReviewers([]);
      setApprovers([]);
      return;
    }
    setReviewers(buildInitialReviewers(existingData.form.reviewer, existingData.form.department, workflowUsers));
    setApprovers(buildInitialApprovers(existingData.form.approver, existingData.form.department, workflowUsers));
  }, [existingData, workflowUsers]);

  const currentStepIndex = WORKFLOW_STEPS.indexOf("Draft");
  const showReviewerApproverButtons = mode === "edit" || isUploadSaved;
  const canPersistMaterial =
    mode === "upload" ? canCreateTrainingMaterials : canEditTrainingMaterials;
  const showSubmitButton =
    canSubmitTrainingMaterials &&
    (mode === "edit" || (isUploadSaved && reviewers.length > 0 && approvers.length > 0));

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

  const materialTabs = useMemo<TabItem[]>(() => [
    { id: TAB_IDS.fileUpload, label: "File Upload" },
    { id: TAB_IDS.materialInformation, label: "Material Information" },
    { id: TAB_IDS.reviewers, label: "Reviewers", count: reviewers.length },
    { id: TAB_IDS.approvers, label: "Approvers", count: approvers.length },
    { id: TAB_IDS.auditTrail, label: "Audit Trail" },
  ], [reviewers.length, approvers.length]);


  const uploadModeTabs = useMemo<TabItem[]>(() => [
    { id: "file", label: "Upload File", icon: CloudUpload },
    { id: "link", label: "Paste Link", icon: Link2 },
  ], []);

  const generatedNameSourceFile = useMemo(() => {
    if (mode === "upload" && uploadedFile?.status === "success") {
      return uploadedFile.name;
    }
    if (mode === "edit" && newFile?.status === "success") {
      return newFile.name;
    }
    return null;
  }, [mode, uploadedFile, newFile]);

  const updateField = useCallback(
    <K extends keyof MaterialWorkflowFormData>(key: K, value: MaterialWorkflowFormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleReviewersChange = useCallback((nextReviewers: Reviewer[]) => {
    setReviewers(nextReviewers);
    updateField(
      "reviewer",
      nextReviewers.map((reviewer) => reviewer.username).join(", "),
    );
  }, [updateField]);

  const handleApproversChange = useCallback((nextApprovers: Approver[]) => {
    setApprovers(nextApprovers);
    updateField("approver", nextApprovers[0]?.username ?? "");
  }, [updateField]);

  const handleGenerateMaterialName = useCallback(() => {
    if (!generatedNameSourceFile) return;
    const generatedName = generatedNameSourceFile
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (generatedName) {
      updateField("materialName", generatedName);
    }
  }, [generatedNameSourceFile, updateField]);

  const formatDateTime = useCallback((date: Date): string => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    const ext = `.${file.name.toLowerCase().split(".").pop()}`;
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return `Invalid file format. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`;
    }
    return null;
  }, []);

  const simulateUpload = useCallback((file: File) => {
    const uploadFile: MaterialUploadedFile = {
      id: Date.now().toString(),
      file,
      name: file.name,
      size: file.size,
      type: file.name,
      progress: 0,
      status: "uploading",
    };
    setUploadedFile(uploadFile);

    const fileType = getFileTypeFromName(file.name);
    const autoCode = generateMaterialNumber(fileType);
    setFormData((prev) => ({
      ...prev,
      materialNumber: prev.materialNumber || autoCode,
    }));

    let progress = 0;
    const interval = setInterval(() => {
      // Slower progress: 5-15% per tick
      progress += Math.random() * 10 + 5;
      
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // First show 100%
        setUploadedFile((prev) =>
          prev ? { ...prev, progress: 100 } : null,
        );

        // Small delay before setting success status (which hides the bar)
        setTimeout(() => {
          setUploadedFile((prev) =>
            prev ? { ...prev, status: "success" } : null,
          );
        }, 600);
      } else {
        setUploadedFile((prev) =>
          prev ? { ...prev, progress: Math.round(progress) } : null,
        );
      }
    }, 400);
  }, []);

  const simulateReplacementUpload = useCallback((file: File) => {
    const replacementFile: EditUploadedFile = {
      id: Date.now().toString(),
      file,
      name: file.name,
      size: file.size,
      type: file.name,
      progress: 0,
      status: "uploading",
    };
    setNewFile(replacementFile);

    let progress = 0;
    const interval = setInterval(() => {
      // Slower progress: 5-15% per tick
      progress += Math.random() * 10 + 5;

      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        // First show 100%
        setNewFile((prev) =>
          prev ? { ...prev, progress: 100 } : null,
        );

        // Small delay before setting success status (which hides the bar)
        setTimeout(() => {
          setNewFile((prev) =>
            prev ? { ...prev, status: "success" } : null,
          );
        }, 600);
      } else {
        setNewFile((prev) =>
          prev ? { ...prev, progress: Math.round(progress) } : null,
        );
      }
    }, 400);
  }, []);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const error = validateFile(file);
    if (error) {
      setModalType("error");
      setModalTitle("File Upload Error");
      setModalDescription(error);
      setModalAction(null);
      setIsModalOpen(true);
      return;
    }

    if (mode === "edit") {
      simulateReplacementUpload(file);
      setIsReplacingFile(false);
      return;
    }

    simulateUpload(file);
  }, [mode, simulateReplacementUpload, simulateUpload, validateFile]);

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
  }, [handleFileSelect]);

  const removeUploadedFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeReplacementFile = () => {
    setNewFile(null);
    setIsReplacingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddLink = () => {
    const url = formData.externalUrl.trim();
    if (!url) return;
    if (!isValidUrl(url)) {
      setModalType("error");
      setModalTitle("Invalid URL");
      setModalDescription(
        "Please enter a valid URL (e.g., https://example.com/document.pdf)",
      );
      setModalAction(null);
      setIsModalOpen(true);
      return;
    }

    if (!formData.materialName) {
      try {
        const urlObj = new URL(url);
        const pathName = urlObj.pathname.split("/").pop() || "";
        const name = decodeURIComponent(pathName)
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]/g, " ");
        if (name) updateField("materialName", name);
      } catch {
        // Ignore parse failure for mock URL autofill.
      }
    }

    if (!formData.materialNumber) {
      updateField("materialNumber", generateMaterialNumber("Document"));
    }
  };

  const validateSaveForm = (): string[] | null => {
    const errors: string[] = [];

    // 1. Content Validation
    if (mode === "upload") {
      if (uploadMode === "file") {
        if (!uploadedFile || uploadedFile.status !== "success") {
          errors.push("Training material file is required.");
        }
      } else if (uploadMode === "link") {
        if (!formData.externalUrl.trim()) {
          errors.push("External resource URL is required.");
        } else if (!isValidUrl(formData.externalUrl.trim())) {
          errors.push("The external URL provided is invalid.");
        }
      }
    }

    // 2. Metadata Validation
    if (!formData.materialName.trim()) {
      errors.push("Material Name is required.");
    }
    
    if (mode === "edit" && !formData.materialNumber.trim()) {
      errors.push("Material Number is missing.");
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

    if (!formData.description.trim()) {
      errors.push("Material Description is required.");
    }

    // 3. Workflow Validation (only for edit mode where reviewers/approvers are visible)
    if (mode === "edit") {
      if (reviewers.length === 0) {
        errors.push("At least one Reviewer must be assigned.");
      }
      if (approvers.length === 0) {
        errors.push("At least one Approver must be assigned.");
      }
    }

    return errors.length > 0 ? errors : null;
  };

  const validateSubmitForm = (): string[] | null => {
    const errors = validateSaveForm() || [];
    
    if (!formData.materialNumber.trim()) {
      errors.push("Material Number is required before submitting for review.");
    }
    
    if (reviewers.length === 0) {
      errors.push("At least one Reviewer must be assigned before submission.");
    }
    
    if (approvers.length === 0) {
      errors.push("At least one Approver must be assigned before submission.");
    }
    
    return errors.length > 0 ? errors : null;
  };

  const handleSave = () => {
    const errors = validateSaveForm();
    if (errors) {
      setModalType("error");
      setModalTitle("Incomplete Information");
      setModalDescription(
        <div className="space-y-2">
          <p>Please provide the following required information before saving:</p>
          <ul className="list-disc list-inside text-xs text-slate-500 space-y-1">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      );
      setModalConfirmText(undefined);
      setModalCancelText(undefined);
      setModalAction(null);
      setIsModalOpen(true);
      return;
    }

    setModalType("confirm");
    setModalTitle(mode === "upload" ? "Save Material?" : "Save Changes?");
    setModalDescription(
      mode === "upload"
        ? "Are you sure you want to save this training material and proceed to the next step?"
        : "Are you sure you want to save the changes to this material?"
    );
    setModalConfirmText("Save & Next");
    setModalCancelText("Discard");
    setModalAction(() => async () => {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (mode === "upload") {
        setFormData((prev) => {
          if (prev.materialNumber.trim()) return prev;
          const generatedCode = uploadMode === "file" && uploadedFile?.status === "success"
            ? generateMaterialNumber(getFileTypeFromName(uploadedFile.name))
            : generateMaterialNumber("Document");
          return { ...prev, materialNumber: generatedCode };
        });
        setIsUploadSaved(true);
      }

      setIsLoading(false);
      setIsModalOpen(false);
    });
    setIsModalOpen(true);
  };

  const handleSubmitForReview = () => {
    const errors = validateSubmitForm();
    if (errors) {
      setModalType("error");
      setModalTitle("Cannot Submit for Review");
      setModalDescription(
        <div className="space-y-2">
          <p>The following requirements must be met before submission:</p>
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

  const handleESignConfirm = async (_reason: string) => {
    setIsLoading(true);
    try {
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
      setCreatedTime(formatDateTime(new Date()));
      setModalType("success");
      setModalTitle("Submitted for Review");
      setModalDescription(
        mode === "upload"
          ? "Training material has been submitted for review. The reviewer will be notified."
          : "Training material has been updated and submitted for review. The reviewer will be notified.",
      );
      setModalConfirmText(undefined);
      setModalCancelText(undefined);
      setModalAction(() => () => navigateBack(navigate, null, ROUTES.TRAINING.MATERIALS));
      setIsModalOpen(true);
      setShowESignModal(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setShowDiscardGuard(true);
  };

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title={title}
        breadcrumbItems={breadcrumbItems}
        actions={(
          <>
            <Button
              variant="outline-emerald"
              onClick={handleCancel}
              size="sm"
              className="whitespace-nowrap"
            >
              Cancel
            </Button>
            <Button
              variant="outline-emerald"
              onClick={handleSave}
              size="sm"
              className="whitespace-nowrap"
              disabled={isLoading}
              hidden={!canPersistMaterial}
            >
              {isLoading ? <ButtonLoading text="Saving..." /> : "Save"}
            </Button>
            {showSubmitButton && (
              <Button
                onClick={handleSubmitForReview}
                variant="outline-emerald"
                size="sm"
                className="whitespace-nowrap"
                disabled={isLoading}
              >
                Submit for Review
              </Button>
            )}
          </>
        )}
      />

      {mode === "edit" && (
        <WarningBanner
          variant="warning"
          title="Editing Draft Material"
          description={
            <p>
              You are editing <span className="font-semibold">{formData.materialNumber} - {formData.materialName}</span>. Edits are only permitted while the material is in <span className="font-semibold">Draft</span> status. Save your changes or submit for review when ready.
            </p>
          }
        />
      )}

      <WorkflowStepper steps={WORKFLOW_STEPS} currentStepIndex={currentStepIndex} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav
          tabs={materialTabs}
          activeTab={activeTab}
          onChange={(tabId) => {
            if (
              mode === "upload" &&
              !isUploadSaved &&
              (tabId === TAB_IDS.reviewers || tabId === TAB_IDS.approvers)
            ) {
              return;
            }
            setActiveTab(tabId);
          }}
        />

        <div className="p-4 md:p-5">
          <div className={cn(activeTab !== TAB_IDS.materialInformation && "hidden")}>
            <MaterialEditorInformationTab
              mode={mode}
              formData={formData}
              updateField={updateField}
              generatedNameSourceFile={generatedNameSourceFile}
              handleGenerateMaterialName={handleGenerateMaterialName}
              departmentOptions={departmentOptions}
              businessUnitOptions={BUSINESS_UNIT_OPTIONS}
              createdTime={createdTime}
            />

          </div>

          <div className={cn(activeTab !== TAB_IDS.fileUpload && "hidden")}>
            <MaterialEditorUploadTab
              mode={mode}
              uploadMode={uploadMode}
              uploadModeTabs={uploadModeTabs}
              setUploadMode={(nextMode) => {
                setUploadMode(nextMode);
                if (mode === "edit") {
                  setNewFile(null);
                  setIsReplacingFile(false);
                }
              }}
              existingData={existingData}
              fileInputRef={fileInputRef}
              handleFileSelect={handleFileSelect}
              uploadedFile={uploadedFile}
              newFile={newFile}
              isReplacingFile={isReplacingFile}
              setIsReplacingFile={setIsReplacingFile}
              isDragActive={isDragActive}
              handleDragOver={handleDragOver}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              removeUploadedFile={removeUploadedFile}
              removeReplacementFile={removeReplacementFile}
              formData={formData}
              updateField={updateField}
              isValidUrl={isValidUrl}
              handleAddLink={handleAddLink}
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
        <Button
          variant="outline-emerald"
          onClick={handleCancel}
          size="sm"
          className="whitespace-nowrap"
        >
          Cancel
        </Button>
        <Button
          variant="outline-emerald"
          onClick={handleSave}
          size="sm"
          className="whitespace-nowrap"
          disabled={isLoading}
          hidden={!canPersistMaterial}
        >
          {isLoading ? <ButtonLoading text="Saving..." /> : "Save"}
        </Button>
        {showSubmitButton && (
          <Button
            onClick={handleSubmitForReview}
            variant="outline-emerald"
            size="sm"
            className="whitespace-nowrap"
            disabled={isLoading}
          >
            Submit for Review
          </Button>
        )}
        {canPersistMaterial && showReviewerApproverButtons && (
          <>
            <div className="w-px h-8 bg-slate-500 mx-1"></div>
            <Button
              variant="outline-emerald"
              onClick={() => {
                setActiveTab(TAB_IDS.reviewers);
                setIsReviewerModalOpen(true);
              }}
              size="sm"
              className="whitespace-nowrap"
            >
              Reviewers
            </Button>
            <Button
              variant="outline-emerald"
              onClick={() => {
                setActiveTab(TAB_IDS.approvers);
                setIsApproverModalOpen(true);
              }}
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
        onConfirm={modalAction ? () => {
          modalAction();
        } : undefined}
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
        onConfirm={() => navigateBack(navigate, null, ROUTES.TRAINING.MATERIALS)}
        mode="discard"
        currentPageTitle="Material Editor"
        title="Discard Changes?"
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

export const UploadMaterialView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <MaterialEditorContent
      mode="upload"
      title="Create Training Material"
      breadcrumbItems={uploadMaterial(navigate, location.state?.from as string | undefined)}
    />
  );
};

export const EditMaterialView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { materialId } = useParams<{ materialId: string }>();
  const [isNavigatingOut, setIsNavigatingOut] = useState(false);

  const existingData = MOCK_MATERIAL_DATA[materialId ?? ""] ?? null;

  if (!existingData || existingData.status !== "Draft") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <Lock className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          Cannot Edit Material
        </h2>
        <p className="text-sm text-slate-500 text-center max-w-sm">
          Only materials with <span className="font-semibold text-slate-700">Draft</span> status can be edited. This material is currently <span className="font-semibold text-slate-700">{existingData ? existingData.status : "not found"}</span>.
        </p>
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

  return (
    <MaterialEditorContent
      mode="edit"
      title="Edit Training Material"
      breadcrumbItems={materialEdit(navigate, location.state?.from as string | undefined)}
      existingData={existingData}
    />
  );
};
