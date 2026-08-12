import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Award, Upload, X as XIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { cn } from "@/components/ui/utils";
import type { Certification } from "../types";

interface CertAddModalProps {
  isOpen: boolean; // Added isOpen prop for external control
  onClose: () => void;
  onSave: (data: Omit<Certification, "id">, file: File | null) => void;
  editing?: Certification | null;
}

export const CertAddModal: React.FC<CertAddModalProps> = ({ isOpen, onClose, onSave, editing }) => {
  const [name, setName] = useState(editing?.name ?? "");
  const [issuingOrg, setIssuingOrg] = useState(editing?.issuingOrg ?? "");
  const [issueDate, setIssueDate] = useState(editing?.issueDate ?? "");
  const [expiryDate, setExpiryDate] = useState(editing?.expiryDate ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens or editing changes
  React.useEffect(() => {
    if (isOpen) {
      setName(editing?.name ?? "");
      setIssuingOrg(editing?.issuingOrg ?? "");
      setIssueDate(editing?.issueDate ?? "");
      setExpiryDate(editing?.expiryDate ?? "");
      setFile(null);
      setErrors({});
    }
  }, [isOpen, editing]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Certificate name is required";
    if (!issuingOrg.trim()) errs.issuingOrg = "Issuing organization is required";
    return errs;
  };

  const handleSave = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave({
      name: name.trim(),
      issuingOrg: issuingOrg.trim(),
      issueDate,
      expiryDate,
      fileObjectUrl: editing?.fileObjectUrl,
      fileName: file ? file.name : editing?.fileName,
      fileSize: file ? file.size : editing?.fileSize,
      fileType: file ? file.type : editing?.fileType,
    }, file);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleSave}
      title={editing ? "Edit Certificate" : "Add Certificate"}
      confirmText={editing ? "Save Changes" : "Add Certificate"}
      size="lg"
    >
      <div className="space-y-4">
        {/* Certificate Name */}
        <div>
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
            Certificate Name <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ISO 9001 Lead Auditor"
            className={cn(
              "w-full h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-1 transition-colors placeholder:text-slate-400",
              errors.name
                ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
            )}
          />
          {errors.name && <p className="text-xs text-red-600 font-medium mt-1.5">{errors.name}</p>}
        </div>

        {/* Issuing Organization */}
        <div>
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
            Issuing Organization <span className="text-red-500">*</span>
          </label>
          <input
            value={issuingOrg}
            onChange={(e) => setIssuingOrg(e.target.value)}
            placeholder="e.g. Bureau Veritas"
            className={cn(
              "w-full h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-1 transition-colors placeholder:text-slate-400",
              errors.issuingOrg
                ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
            )}
          />
          {errors.issuingOrg && <p className="text-xs text-red-600 font-medium mt-1.5">{errors.issuingOrg}</p>}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <DateTimePicker
            label="Issue Date"
            value={issueDate}
            onChange={setIssueDate}
          />
          <DateTimePicker
            label="Expiry Date"
            value={expiryDate}
            onChange={setExpiryDate}
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
            Certificate File
          </label>
          <div
            className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Upload className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : editing?.fileName ? (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Upload className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-slate-600 truncate">{editing.fileName}</p>
                  <p className="text-xs text-slate-400">Click to replace file</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Upload className="h-6 w-6 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-500">Click to upload or drag &amp; drop</p>
                <p className="text-xs text-slate-400">PDF, JPG, PNG, DOCX (max 10MB)</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </FormModal>
  );
};
