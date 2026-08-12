import React from "react";
import { Button } from "@/components/ui/button/Button";
import { Info } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { Select } from "@/components/ui/select/Select";
import type {
  MaterialRevisionFormData,
  MaterialWorkflowFormData,
  TrainingMaterialWorkflow,
} from "@/features/training/materials/types";

// ─── Shared Components ────────────────────────────────────────────────────────

interface MaterialFieldProps {
  label: React.ReactNode;
  value: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  type?: "text" | "textarea" | "url";
  helperText?: string;
  error?: boolean;
  required?: boolean;
  rows?: number;
  suffix?: React.ReactNode;
}

const MaterialField: React.FC<MaterialFieldProps> = ({
  label,
  value,
  readOnly,
  onChange,
  placeholder,
  className,
  type = "text",
  helperText,
  required,
  rows = 4,
  suffix,
}) => (
  <div>
    <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      {type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          rows={rows}
          className={cn(
            "w-full px-4 py-3 border border-slate-200 rounded-lg text-sm transition-colors resize-none",
            readOnly
              ? "bg-slate-50 text-slate-900 cursor-default focus:outline-none"
              : "focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400",
            className
          )}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          className={cn(
            "w-full h-9 px-4 border border-slate-200 rounded-lg text-sm transition-colors",
            readOnly
              ? "bg-slate-50 text-slate-900 cursor-default focus:outline-none"
              : "focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400",
            suffix && "pr-24",
            className
          )}
        />
      )}
      {suffix && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
          {suffix}
        </div>
      )}
    </div>
    {helperText && (
      <p className="text-2xs sm:text-xs font-normal text-slate-400 flex items-center gap-1">
        {helperText}
      </p>
    )}
  </div>
);

interface CommonInfoFieldsProps {
  data: {
    materialName: string;
    materialNumber: string;
    version: string;
    author: string;
    businessUnit?: string;
    department: string;
    description: string;
    periodicReviewCycle: number;
    periodicReviewNotification: number;
    effectiveDate: string;
    validUntil: string;
    reviewDate: string;
  };
  readOnly?: boolean;
  updateField?: (key: any, value: string) => void;
  createdTime?: string;
  businessUnitOptions?: { label: string; value: string }[];
  departmentOptions?: { label: string; value: string }[];
  handleGenerateMaterialName?: () => void;
  generatedNameSourceFile?: string | null;
  mode?: "upload" | "edit" | "revision" | "readonly";
}

const CommonInfoFields: React.FC<CommonInfoFieldsProps> = ({
  data,
  readOnly,
  updateField,
  createdTime,
  businessUnitOptions,
  departmentOptions,
  handleGenerateMaterialName,
  generatedNameSourceFile,
  mode,
}) => {
  return (
    <div className="space-y-5">
      {/* Row 1: Material Number, Created Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MaterialField
          label="Material Number"
          value={data.materialNumber}
          readOnly
          placeholder={mode === "upload" ? "Auto-generated after successful Save" : ""}
          helperText={
            mode === "readonly"
              ? undefined
              : mode === "upload"
                ? "Material Number is generated automatically after successful Save."
                : "Material Number cannot be changed after creation."
          }
        />
        <MaterialField
          label="Created Time"
          value={createdTime || ""}
          readOnly
          placeholder="Auto-generated when submitted"
        />
      </div>

      {/* Row 2: Material Name, Version */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MaterialField
          label="Material Name"
          value={data.materialName}
          readOnly={readOnly}
          onChange={(val) => updateField?.("materialName", val)}
          required={!readOnly}
          placeholder="Enter material name..."
          suffix={
            !readOnly && generatedNameSourceFile ? (
              <button
                type="button"
                onClick={handleGenerateMaterialName}
                className="h-6 px-2 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors"
              >
                Generate
              </button>
            ) : null
          }
        />
        <MaterialField
          label="Version"
          value={data.version}
          readOnly
          helperText={
            mode === "readonly"
              ? undefined
              : mode === "revision"
                ? "Auto-suggested based on revision type."
                : mode === "upload"
                  ? "Default 1.0 for initial upload."
                  : "Version is managed by the approval workflow."
          }
        />
      </div>

      {/* Row 3: Author, Created Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MaterialField
          label="Author"
          value={data.author}
          readOnly
          helperText={mode === "readonly" ? undefined : "Automatically set to the current logged-in user."}
        />
        <MaterialField
          label="Created Time"
          value={createdTime || ""}
          readOnly
          placeholder="Auto-generated when submitted"
        />
      </div>

      {/* Row 4: Business Unit, Department */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {readOnly ? (
          <>
            <MaterialField label="Business Unit" value={data.businessUnit || "—"} readOnly />
            <MaterialField label="Department" value={data.department} readOnly />
          </>
        ) : (
          <>
            <Select
              label={
                <span>
                  Business Unit <span className="text-red-500">*</span>
                </span>
              }
              value={data.businessUnit || ""}
              onChange={(value) => {
                updateField?.("businessUnit", value as string);
                updateField?.("department", "");
              }}
              options={businessUnitOptions || []}
              placeholder="Select business unit..."
            />
            <Select
              label={
                <span>
                  Department <span className="text-red-500">*</span>
                </span>
              }
              value={data.department}
              onChange={(value) => updateField?.("department", value as string)}
              options={departmentOptions || []}
              placeholder={data.businessUnit ? "Select department..." : "Select Business Unit first"}
              disabled={!data.businessUnit}
            />
          </>
        )}
      </div>

      {/* Row 5: Periodic Review Cycle (Months), Periodic Review Notification (Days) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Periodic Review Cycle (Months) {!readOnly && <span className="text-red-500">*</span>}
          </label>
          <input
            type="number"
            value={data.periodicReviewCycle || ""}
            onChange={(e) => updateField?.("periodicReviewCycle", e.target.value)}
            readOnly={readOnly}
            placeholder="e.g. 24"
            className={cn(
              "w-full h-9 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors",
              readOnly 
                ? "bg-slate-50 border-slate-200 text-slate-700 cursor-default" 
                : "bg-white border-slate-200 text-slate-900 cursor-text"
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Periodic Review Notification (Days) {!readOnly && <span className="text-red-500">*</span>}
          </label>
          <input
            type="number"
            value={data.periodicReviewNotification || ""}
            onChange={(e) => updateField?.("periodicReviewNotification", e.target.value)}
            readOnly={readOnly}
            placeholder="e.g. 30"
            className={cn(
              "w-full h-9 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors",
              readOnly 
                ? "bg-slate-50 border-slate-200 text-slate-700 cursor-default" 
                : "bg-white border-slate-200 text-slate-900 cursor-text"
            )}
          />
        </div>
      </div>

      {/* Row 6: Effective Date, Valid Until */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Effective Date</label>
          <input
            type="text"
            value={data.effectiveDate}
            readOnly
            placeholder="Set when approved"
            className="w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Valid Until</label>
          <input
            type="text"
            value={data.validUntil}
            readOnly
            placeholder="Set when approved"
            className="w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default"
          />
        </div>
      </div>

      {/* Row 7: Review Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Review Date</label>
          <input
            type="text"
            value={data.reviewDate}
            readOnly
            placeholder="YYYY-MM-DD"
            className="w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default"
          />
        </div>
      </div>

      {/* Row 8: Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs sm:text-sm font-medium text-slate-700">
          Description {!readOnly && <span className="text-red-500">*</span>}
        </label>
        <textarea
          value={data.description}
          onChange={(e) => updateField?.("description", e.target.value)}
          readOnly={readOnly}
          rows={4}
          placeholder="Describe the content or purpose of this training material..."
          className={cn(
            "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none",
            readOnly 
              ? "bg-slate-50 border-slate-200 text-slate-700 cursor-default" 
              : "bg-white border-slate-200 text-slate-900 cursor-text"
          )}
        />
      </div>
    </div>
  );
};

// ─── Main Tab Components ──────────────────────────────────────────────────────

interface MaterialEditorInformationTabProps {
  mode: "upload" | "edit";
  formData: MaterialWorkflowFormData;
  updateField: (key: keyof MaterialWorkflowFormData, value: any) => void;
  generatedNameSourceFile: string | null;
  handleGenerateMaterialName: () => void;
  departmentOptions: { label: string; value: string }[];
  businessUnitOptions: { label: string; value: string }[];
  createdTime: string;
}

export const MaterialEditorInformationTab: React.FC<MaterialEditorInformationTabProps> = ({
  mode,
  formData,
  updateField,
  generatedNameSourceFile,
  handleGenerateMaterialName,
  departmentOptions,
  businessUnitOptions,
  createdTime,
}) => {
  return (
    <div className="space-y-4">
      <CommonInfoFields
        mode={mode}
        data={{
          materialName: formData.materialName,
          materialNumber: formData.materialNumber,
          version: formData.version,
          author: formData.author,
          businessUnit: formData.businessUnit,
          department: formData.department,
          description: formData.description,
          periodicReviewCycle: formData.periodicReviewCycle,
          periodicReviewNotification: formData.periodicReviewNotification,
          effectiveDate: formData.effectiveDate,
          validUntil: formData.validUntil,
          reviewDate: formData.reviewDate,
        }}
        updateField={updateField}
        createdTime={createdTime}
        businessUnitOptions={businessUnitOptions}
        departmentOptions={departmentOptions}
        handleGenerateMaterialName={handleGenerateMaterialName}
        generatedNameSourceFile={generatedNameSourceFile}
      />
    </div>
  );
};

interface MaterialRevisionInformationTabProps {
  formData: MaterialRevisionFormData;
  updateField: (key: keyof MaterialRevisionFormData, value: any) => void;
  departmentOptions: { label: string; value: string }[];
  businessUnitOptions: { label: string; value: string }[];
  createdTime: string;
}

export const MaterialRevisionInformationTab: React.FC<MaterialRevisionInformationTabProps> = ({
  formData,
  updateField,
  departmentOptions,
  businessUnitOptions,
  createdTime,
}) => {
  return (
    <div className="space-y-4">
      <CommonInfoFields
        mode="revision"
        data={{
          materialName: formData.materialName,
          materialNumber: formData.materialNumber,
          version: formData.version,
          author: formData.author,
          businessUnit: formData.businessUnit,
          department: formData.department,
          description: formData.description,
          periodicReviewCycle: formData.periodicReviewCycle,
          periodicReviewNotification: formData.periodicReviewNotification,
          effectiveDate: formData.effectiveDate,
          validUntil: formData.validUntil,
          reviewDate: formData.reviewDate,
        }}
        updateField={updateField}
        createdTime={createdTime}
        businessUnitOptions={businessUnitOptions}
        departmentOptions={departmentOptions}
      />
    </div>
  );
};

export const MaterialInfoReadOnly: React.FC<{ material: TrainingMaterialWorkflow }> = ({
  material,
}) => (
  <div className="space-y-4">
    <CommonInfoFields
      mode="readonly"
      readOnly
      data={{
        materialName: material.title,
        materialNumber: material.materialNumber,
        version: material.version,
        author: material.uploadedBy,
        businessUnit: material.businessUnit,
        department: material.department,
        description: material.description || "",
        periodicReviewCycle: material.periodicReviewCycle || 0,
        periodicReviewNotification: material.periodicReviewNotification || 0,
        effectiveDate: material.effectiveDate || "—",
        validUntil: material.validUntil || "—",
        reviewDate: material.reviewDate || "—",
      }}
      createdTime={material.uploadedAt}
    />

    {material.status === "Draft" && material.reviewComment && (
      <div className="mt-8 border-t border-slate-100 pt-8">
        <div className="flex items-center gap-2 px-1 mb-4">
          <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
            <Info className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Rejection Reason</h3>
        </div>
        <div className="bg-red-50/50 border border-red-100 rounded-xl p-4">
          <p className="text-sm text-red-800 leading-relaxed">
            {material.reviewComment}
          </p>
        </div>
      </div>
    )}
  </div>
);
