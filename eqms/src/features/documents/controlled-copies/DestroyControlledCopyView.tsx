import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ROUTES } from '@/app/routes.constants';
import {
  ArrowLeft,
  Upload,
  Calendar,
  FileText,
  X,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { useToast } from "@/components/ui/toast/Toast";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form";
import { destroyControlledCopy } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { documentApi } from "@/services/api/documents";
import { metadataApi } from "@/services/api/metadata";
import { Select } from "@/components/ui/select/Select";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { IconPhoto } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import type { ControlledCopy, ControlledCopyStatus, CurrentStage } from "./types";
import { formatDocumentLabel } from "./display";
import { normalizeControlledCopyRecord } from "./controlledCopyMapping";
import { isControlledCopyBatchRow } from "./controlledCopyActions";
import {
  getControlledCopyActionDecision,
  getControlledCopyActionDeniedReason,
} from "./controlledCopyCapabilities";
import { useControlledCopyActionCapabilities } from "@/hooks";
import type { ControlledCopyRouteState } from "./controlledCopyNavigation";


interface EvidenceFile {
  file: File;
  preview: string;
  id: string;
}

interface DestructionFormData {
  destructionDate: string;
  destructionMethod: string;
  destructedBy: string;
  destructionSupervisor: string;
  evidenceFiles: EvidenceFile[];
}

interface SelectOption {
  label: string;
  value: string;
}

const DEFAULT_CONTROLLED_COPY_STATUS: ControlledCopyStatus = "Distributed";
const DEFAULT_CURRENT_STAGE: CurrentStage = "Distributed";

function mapControlledCopyPayload(payload: any, fallbackId: string): ControlledCopy {
  const mapped = normalizeControlledCopyRecord(payload, fallbackId);
  return {
    ...mapped,
    status: (payload?.status || DEFAULT_CONTROLLED_COPY_STATUS) as ControlledCopyStatus,
    currentStage: (payload?.currentStage || DEFAULT_CURRENT_STAGE) as CurrentStage,
  };
}

export const DestroyControlledCopyView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as ControlledCopyRouteState | undefined;
  const { showToast } = useToast();

  // Get destruction type from URL params or navigation state
  const [destructionType, setDestructionType] = useState<"Lost" | "Damaged">("Damaged");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const typeParam = params.get("type");

    if (typeParam === "Lost" || typeParam === "Damaged") {
      setDestructionType(typeParam);
    } else if (location.state?.type) {
      setDestructionType(location.state.type);
    } else {
      // Redirect back if no type specified
      navigate(location.state?.from || ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL, { replace: true });
    }
  }, [location]);

  // Get current datetime when component mounts
  const getCurrentDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState<DestructionFormData>({
    destructionDate: getCurrentDateTime(),
    destructionMethod: "",
    destructedBy: "",
    destructionSupervisor: "",
    evidenceFiles: [],
  });

  const [isesignModalOpen, setisesignModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [controlledCopy, setControlledCopy] = useState<ControlledCopy | null>(null);
  const [userOptions, setUserOptions] = useState<SelectOption[]>([]);
  const {
    capabilities,
    loading: isCapabilityLoading,
  } = useControlledCopyActionCapabilities(id || null);
  const reportLostDamagedDecision = getControlledCopyActionDecision(capabilities, "reportLostDamaged");

  useEffect(() => {
    let mounted = true;

    const loadDependencies = async () => {
      if (!id) {
        return;
      }
      try {
        setIsLoading(true);
        const usersPromise = metadataApi.getUsersLookup();
        const copyPromise = locationState?.preloadedControlledCopy?.id === id
          ? Promise.resolve(locationState.preloadedControlledCopy)
          : documentApi.getControlledCopyDetailSnapshotById(id);
        const [copyPayload, users] = await Promise.all([copyPromise, usersPromise]);
        if (!mounted) {
          return;
        }
        const mappedCopy = mapControlledCopyPayload(copyPayload, id);
        if (isControlledCopyBatchRow(mappedCopy)) {
          showToast({
            type: "error",
            title: "Action not available",
            message: "Report Lost/Damaged is only available for a single controlled copy record.",
            duration: 4000,
          });
          navigate(location.state?.from || ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL, { replace: true });
          return;
        }
        setControlledCopy(mappedCopy);
        setUserOptions(
          users.map((user) => ({
            value: user.id,
            label: user.department ? `${user.fullName} - ${user.department}` : user.fullName,
          }))
        );
      } catch (error) {
        console.error("Failed to load controlled copy destruction context", error);
        if (!mounted) {
          return;
        }
        showToast({
          type: "error",
          title: "Unable to load controlled copy",
          message: "Controlled copy information could not be loaded from the server.",
          duration: 3500,
        });
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDependencies();

    return () => {
      mounted = false;
    };
  }, [id, locationState?.preloadedControlledCopy, showToast]);

  const handleInputChange = (field: keyof DestructionFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file sizes
    const invalidFiles = files.filter(file => file.size > 10 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      setErrors((prev) => ({ ...prev, evidenceFile: "Some files exceed 10MB limit" }));
      return;
    }

    // Validate file types
    const nonImageFiles = files.filter(file => !["image/jpeg", "image/png"].includes(file.type.toLowerCase()));
    if (nonImageFiles.length > 0) {
      setErrors((prev) => ({ ...prev, evidenceFile: "Only JPEG and PNG evidence files are allowed" }));
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const newEvidenceFiles: EvidenceFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newEvidenceFiles.push({
            file,
            preview: reader.result as string,
            id: `${Date.now()}-${i}`,
          });
          setUploadProgress(Math.round(((i + 1) / files.length) * 100));
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    setFormData((prev) => ({
      ...prev,
      evidenceFiles: [...prev.evidenceFiles, ...newEvidenceFiles],
    }));

    setIsUploading(false);
    setUploadProgress(0);

    if (errors.evidenceFile) {
      setErrors((prev) => ({ ...prev, evidenceFile: "" }));
    }

    // Reset input
    e.target.value = "";
  };

  const handleRemoveFile = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      evidenceFiles: prev.evidenceFiles.filter(file => file.id !== id),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.destructionDate) {
      newErrors.destructionDate = "Destruction date is required";
    } else if (new Date(formData.destructionDate).getTime() > Date.now()) {
      newErrors.destructionDate = "Destruction date cannot be in the future";
    }
    if (!formData.destructionMethod.trim()) {
      newErrors.destructionMethod = "Destruction method is required";
    }
    if (!formData.destructedBy) {
      newErrors.destructedBy = "Executor name is required";
    }
    if (!formData.destructionSupervisor) {
      newErrors.destructionSupervisor = "Supervisor name is required";
    } else if (
      formData.destructedBy &&
      formData.destructionSupervisor === formData.destructedBy
    ) {
      newErrors.destructionSupervisor = "Executor and witness must be different users";
    }
    // Evidence photos only required for Damaged cases
    if (destructionType === "Damaged" && formData.evidenceFiles.length === 0) {
      newErrors.evidenceFile = "At least one evidence photo is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!reportLostDamagedDecision?.allowed) {
      showToast({
        type: "error",
        title: "Action not available",
        message: getControlledCopyActionDeniedReason(reportLostDamagedDecision),
        duration: 3500,
      });
      return;
    }
    if (validateForm()) {
      setisesignModalOpen(true);
    }
  };

  const handleESignConfirm = async (data: { username: string; password: string; reason: string; signatureToken?: string }) => {
    setisesignModalOpen(false);
    setIsLoading(true);
    try {
      if (!id) {
        throw new Error("Missing controlled copy id");
      }
      if (!controlledCopy) {
        throw new Error("Missing controlled copy data");
      }
      if (isControlledCopyBatchRow(controlledCopy)) {
        throw new Error("Report Lost/Damaged is only available for a single controlled copy record.");
      }
      if (!reportLostDamagedDecision?.allowed) {
        throw new Error(getControlledCopyActionDeniedReason(reportLostDamagedDecision));
      }
      const destroyPayload = {
        destroyedByUserId: formData.destructedBy,
        destroyReason: data.reason || formData.destructionMethod,
        witnessedByUserId: formData.destructionSupervisor || undefined,
        destroyedAt: formData.destructionDate,
        destructionMethod: formData.destructionMethod,
        destructionType,
        signatureToken: data.signatureToken as string,
      };
      if (formData.evidenceFiles.length > 0) {
        await documentApi.reportLostDamagedControlledCopyWithEvidence(
          id,
          destroyPayload,
          formData.evidenceFiles.map((item) => item.file),
          (progressEvent) => {
            if (!progressEvent.total) return;
            setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
          },
        );
      } else {
        await documentApi.reportLostDamagedControlledCopy(id, destroyPayload);
      }

      showToast({
        type: "success",
        title: "Controlled Copy Destroyed",
        message: `Controlled copy ${controlledCopy.controlNumber} has been marked as destroyed.`,
        duration: 3500,
      });

      navigate(location.state?.from || ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL, { replace: true });
    } catch (error) {
      if (error && typeof error === "object") {
        const candidate = error as any;
        const status = candidate?.response?.status || candidate?.status || candidate?.response?.data?.status || null;
        if ([403, 409, 410].includes(status)) {
          setIsLoading(false);
          setIsUploading(false);
          setUploadProgress(0);
          showToast({
            type: "error",
            title: "Action not available",
            message: getControlledCopyActionDeniedReason(reportLostDamagedDecision),
            duration: 3500,
          });
          return;
        }
      }
      setIsLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
      const backendMessage =
        (error as any)?.response?.data?.error?.message || (error as any)?.response?.data?.message;
      showToast({
        type: "error",
        title: "Destruction Failed",
        message:
          backendMessage ||
          (error instanceof Error && error.message
            ? error.message
            : "Failed to mark controlled copy as destroyed. Please try again."),
        duration: 3500,
      });
      return;
    }
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleCancelConfirm = () => {
    setIsCancelModalOpen(false);
    setIsNavigating(true);
    const fromPath = location.state?.from || ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL;
    navigate(fromPath, { replace: true });
  };

  if (isLoading || isNavigating || !controlledCopy) return <SectionLoading minHeight="60vh" />;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header: Title + Breadcrumb + Actions */}
      <PageHeader
        title={`Report ${destructionType} Controlled Copy`}
        breadcrumbItems={destroyControlledCopy(undefined, location.state?.from, destructionType)}
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={() => setIsCancelModalOpen(true)}
              disabled={isLoading}
              className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
            >
              Cancel
            </Button>
            {!isCapabilityLoading && reportLostDamagedDecision?.allowed && (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 flex items-center gap-1.5 md:gap-2 touch-manipulation"
              >
                Submit
              </Button>
            )}
          </>
        }
      />

      <WarningBanner
        variant="error"
        title="Irreversible Action - Proceed with Caution"
        description={
          <p>
            This action cannot be undone. Once marked as {destructionType.toLowerCase()}, this controlled copy will
            be permanently removed from active inventory and cannot be recovered. Ensure all
            {destructionType === "Damaged" ? " destruction" : ""} procedures are followed according to company policy.
          </p>
        }
      />

      {/* Controlled Copy Information */}
      <FormSection title="Controlled Copy Information" icon={<Info className="h-4 w-4" />}>
        <div className="space-y-3 lg:space-y-4">
          {/* Control Number */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 pb-3 lg:pb-4 border-b border-slate-200">
            <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Control Number</label>
            <p className="text-xs lg:text-sm text-slate-900 font-medium flex-1">
              {controlledCopy.controlNumber}
            </p>
          </div>

          {/* Copy Number */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 pb-3 lg:pb-4 border-b border-slate-200">
            <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Copy Number</label>
            <p className="text-xs lg:text-sm text-slate-900 flex-1">
              {controlledCopy.copyNumber} of {controlledCopy.totalCopies}
            </p>
          </div>

          {/* Status */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 pb-3 lg:pb-4 border-b border-slate-200">
            <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Status</label>
            <div className="flex-1">
              <Badge color="emerald">
                {controlledCopy.status}
              </Badge>
            </div>
          </div>

          {/* Document */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 pb-3 lg:pb-4 border-b border-slate-200">
            <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Document</label>
            <p className="text-xs lg:text-sm text-slate-900 flex-1">
              {formatDocumentLabel(controlledCopy)}
            </p>
          </div>

          {/* Location */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 pb-3 lg:pb-4 border-b border-slate-200">
            <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Location</label>
            <p className="text-xs lg:text-sm text-slate-900 flex-1">{controlledCopy.location}</p>
          </div>

          {/* Recipient */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 pb-3 lg:pb-4 border-b border-slate-200">
            <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Recipient</label>
            <p className="text-xs lg:text-sm text-slate-900 flex-1">{controlledCopy.recipientName}</p>
          </div>

          {/* Distributed Date */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2">
            <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Distributed Date</label>
            <p className="text-xs lg:text-sm text-slate-900 flex-1">
              {controlledCopy.distributedDate || "—"}
            </p>
          </div>
        </div>
      </FormSection>

      {/* Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Destruction Information */}
        <FormSection title="Destruction Information" icon={<Calendar className="h-4 w-4" />}>
          <div className="space-y-5">
            {/* Destruction Date */}
            <div>
              <DateTimePicker
                label="Destruction Date"
                value={formData.destructionDate}
                onChange={(value) => handleInputChange("destructionDate", value)}
                placeholder="Select date"
                showTime={true}
              />
              {errors.destructionDate && (
                <p className="text-xs text-red-600 mt-1">{errors.destructionDate}</p>
              )}
              <p className="text-xs text-slate-500 mt-1.5">
                Auto-captured at page open time (adjustable)
              </p>
            </div>

            {/* Destruction Method */}
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                Destruction Method <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.destructionMethod}
                onChange={(e) => handleInputChange("destructionMethod", e.target.value)}
                placeholder="e.g., Paper shredding, Incineration, etc."
                className={`w-full h-9 px-4 border rounded-lg text-sm focus:outline-none focus:ring-1 transition-colors ${errors.destructionMethod
                  ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                  : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
                  }`}
              />
              {errors.destructionMethod && (
                <p className="text-xs text-red-600 mt-1">{errors.destructionMethod}</p>
              )}
            </div>

            {/* Executor */}
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                Executor (Person Performing) <span className="text-red-600">*</span>
              </label>
              <Select
                value={formData.destructedBy}
                onChange={(value) => handleInputChange("destructedBy", value)}
                options={userOptions}
                placeholder="Select executor..."
                triggerClassName={errors.destructedBy ? "border-red-300 focus:ring-red-500 focus:border-red-500" : ""}
              />
              {errors.destructedBy && (
                <p className="text-xs text-red-600 mt-1">{errors.destructedBy}</p>
              )}
            </div>

            {/* Supervisor */}
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                Supervisor (Witness) <span className="text-red-600">*</span>
              </label>
              <Select
                value={formData.destructionSupervisor}
                onChange={(value) => handleInputChange("destructionSupervisor", value)}
                options={userOptions}
                placeholder="Select supervisor..."
                triggerClassName={errors.destructionSupervisor ? "border-red-300 focus:ring-red-500 focus:border-red-500" : ""}
              />
              {errors.destructionSupervisor && (
                <p className="text-xs text-red-600 mt-1">{errors.destructionSupervisor}</p>
              )}
              <p className="text-xs text-slate-500 mt-1.5">
                Required for compliance: 2-person verification
              </p>
            </div>
          </div>
        </FormSection>

        {/* Evidence Upload */}
        <FormSection
          title={destructionType === "Damaged" ? "Destruction Evidence" : "Additional Information"}
          icon={<IconPhoto className="h-4 w-4" />}
        >
          <div className="space-y-5">
            {destructionType === "Damaged" ? (
              <>
                {/* File Upload */}
                <div>
                  <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                    Evidence Photos <span className="text-red-600">*</span>
                  </label>

                  {/* Upload Area */}
                  <div className="relative">
                    <input
                      type="file"
                        accept="image/jpeg,image/png"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      id="evidence-upload"
                      disabled={isUploading}
                    />
                    <label
                      htmlFor="evidence-upload"
                      className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isUploading
                        ? "border-slate-200 bg-slate-50 cursor-not-allowed"
                        : errors.evidenceFile
                          ? "border-red-300 bg-red-50 hover:bg-red-100"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                        }`}
                    >
                      {isUploading && isLoading ? (
                        <div className="flex flex-col items-center justify-center w-full px-6">
                          <Upload className="h-8 w-8 mb-3 text-emerald-500 animate-pulse" />
                          <p className="text-sm text-slate-600 font-medium mb-2">
                            Uploading... {uploadProgress}%
                          </p>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-3 pb-4">
                          <Upload
                            className={`h-8 w-8 mb-2 ${errors.evidenceFile ? "text-red-400" : "text-slate-400"
                              }`}
                          />
                          <p className="mb-1 text-sm text-slate-600 font-medium">
                            Click to upload evidence photos
                          </p>
                          <p className="text-xs text-slate-500">JPG, PNG (Max 10MB each, multiple files)</p>
                        </div>
                      )}
                    </label>
                  </div>

                  {errors.evidenceFile && (
                    <p className="text-xs text-red-600 mt-1">{errors.evidenceFile}</p>
                  )}

                  {/* Preview Grid */}
                  {formData.evidenceFiles.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
                      {formData.evidenceFiles.map((evidence, index) => (
                        <div
                          key={evidence.id}
                          className="relative group rounded-lg overflow-hidden border-2 border-slate-200 hover:border-emerald-500 transition-all duration-200 cursor-pointer"
                          onClick={() => setSelectedImageIndex(index)}
                        >
                          <div className="aspect-square">
                            <img
                              src={evidence.preview}
                              alt={`Evidence ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(evidence.id);
                            }}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-xs text-white font-medium truncate">
                              {evidence.file.name}
                            </p>
                            <p className="text-xs text-slate-300">
                              {(evidence.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Evidence Requirements */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-5">
                  <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    Photo Requirements
                  </h4>
                  <ul className="space-y-2 text-xs sm:text-sm text-blue-800 list-disc pl-5 marker:text-blue-600">
                    <li>
                      <span>Clear photo of shredded/destroyed document pieces</span>
                    </li>
                    <li>
                      <span>Or signed destruction record form with timestamp</span>
                    </li>
                    <li>
                      <span>Control number must be visible if possible</span>
                    </li>
                    <li>
                      <span>Photo taken immediately after destruction</span>
                    </li>
                  </ul>
                </div>
              </>
            ) : (
              /* Lost Case - No Evidence Required */
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-5">
                <h4 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                  Lost Controlled Copy Report
                </h4>
                <p className="text-xs sm:text-sm text-amber-800 mb-4">
                  For lost controlled copies, evidence photos are not required. However, please ensure:
                </p>
                <ul className="space-y-2 text-xs sm:text-sm text-amber-800 list-disc pl-5 marker:text-amber-600">
                  <li>
                    <span>Conduct thorough search before reporting as lost</span>
                  </li>
                  <li>
                    <span>Document when and where it was last seen</span>
                  </li>
                  <li>
                    <span>Notify supervisor immediately upon discovery</span>
                  </li>
                  <li>
                    <span>Investigation may be initiated per company policy</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </FormSection>
      </div>

      {/* Summary Block */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 md:p-5">
        <h3 className="text-sm font-semibold text-emerald-900 mb-3 flex items-center gap-2">
          Submission Summary
        </h3>
        <ul className="space-y-2 text-xs sm:text-sm text-emerald-800 list-disc pl-5 marker:text-emerald-600">
          <li>
            <span>This action will permanently mark the controlled copy as <span className="font-semibold">{destructionType.toLowerCase()}</span>.</span>
          </li>
          <li>
            <span>The controlled copy will be removed from active inventory and cannot be recovered.</span>
          </li>
          <li>
            <span>All destruction details will be recorded in the audit trail for compliance tracking.</span>
          </li>
          {destructionType === "Damaged" && formData.evidenceFiles.length > 0 && (
            <li>
              <span><span className="font-semibold">{formData.evidenceFiles.length}</span> evidence photos attached.</span>
            </li>
          )}
        </ul>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline-emerald"
          size="sm"
          onClick={() => setIsCancelModalOpen(true)}
          disabled={isLoading}
          className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
        >
          Cancel
        </Button>
          {!isCapabilityLoading && reportLostDamagedDecision?.allowed && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 flex items-center gap-1.5 md:gap-2 touch-manipulation"
            >
              Submit
            </Button>
          )}
      </div>

      {/* Image Viewer Modal */}
      {selectedImageIndex !== null &&
        createPortal(
          <>
            {/* Backdrop covering full viewport */}
            <div
              className="fixed inset-0 z-[9998] bg-black/90"
              onClick={() => setSelectedImageIndex(null)}
              aria-hidden="true"
            />

            {/* Foreground content */}
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-5">
              <button
                onClick={() => setSelectedImageIndex(null)}
                className="absolute top-2 right-2 md:top-4 md:right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
                aria-label="Close image viewer"
              >
                <X className="h-5 w-5 md:h-6 md:w-6" />
              </button>

              <div className="relative flex items-center justify-center w-full h-full">
                <img
                  src={formData.evidenceFiles[selectedImageIndex].preview}
                  alt={`Evidence ${selectedImageIndex + 1}`}
                  className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg"
                />
                <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm px-3 py-1.5 md:px-4 md:py-2 rounded-full">
                  <p className="text-xs md:text-sm text-white font-medium">
                    {selectedImageIndex + 1} / {formData.evidenceFiles.length}
                  </p>
                </div>

                {/* Navigation buttons */}
                {formData.evidenceFiles.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImageIndex((prev) =>
                          prev! > 0 ? prev! - 1 : formData.evidenceFiles.length - 1
                        );
                      }}
                      className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                      aria-label="Previous image"
                    >
                      <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImageIndex((prev) =>
                          prev! < formData.evidenceFiles.length - 1 ? prev! + 1 : 0
                        );
                      }}
                      className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                      aria-label="Next image"
                    >
                      <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 rotate-180" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </>,
          window.document.body
        )}

      {/* Cancel Confirmation Modal */}
      <AlertModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleCancelConfirm}
        type="warning"
        title="Cancel Destruction Process?"
        description="Are you sure you want to cancel? All entered information will be lost and cannot be recovered."
      />

      {/* E-Signature Modal */}
      <ESignatureModal
        isOpen={isesignModalOpen}
        onClose={() => setisesignModalOpen(false)}
        onConfirm={handleESignConfirm}
        actionTitle="Confirm Controlled Copy Destruction"
      />
    </div>
  );
};
