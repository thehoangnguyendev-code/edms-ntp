import React, { useEffect, useRef, useState } from "react";
import { Upload, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { FormModal } from "@/components/ui/modal/FormModal";
import { documentApi } from "@/services/api/documents";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { buildPreviewCacheBuster, loadPdfPreviewFile } from "@/features/documents/shared/previewHelpers";

interface UploadRevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    file: File | null,
    note: string,
    useTemplate: boolean,
    templateRevisionId?: string,
  ) => void;
  documentName: string;
  revisionNumber: string;
  documentType: string;
  documentTypeShortCode?: string;
  documentSubType?: string;
  canUseTemplate?: boolean;
  maxFileSizeMB?: number;
  /** True while the parent's onConfirm handler is actually uploading -- disables Confirm/Cancel
   * and shows a spinner so a slow upload can't be double-submitted by an impatient click. */
  isSubmitting?: boolean;
}

const buildTemplateLabel = (item: {
  documentNumber: string;
  revisionNumber: string;
  documentName: string;
}) => `${item.documentNumber} · ${item.revisionNumber} · ${item.documentName}`;

export const UploadRevisionModal: React.FC<UploadRevisionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  documentName,
  revisionNumber,
  documentType,
  documentTypeShortCode,
  documentSubType,
  canUseTemplate = false,
  maxFileSizeMB = 25,
  isSubmitting = false,
}) => {
  const [note, setNote] = useState("");
  const [useTemplate, setUseTemplate] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [fileError, setFileError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFileOrTemplate = useTemplate ? !!selectedTemplate : !!selectedFile;
  const maxFileSizeBytes = Math.max(maxFileSizeMB, 1) * 1024 * 1024;
  const displayName = `${documentName}_${revisionNumber}`;

  const renameUploadedFile = (file: File) => {
    const originalName = file.name || "";
    const lastDotIndex = originalName.lastIndexOf(".");
    const extension = lastDotIndex >= 0 ? originalName.slice(lastDotIndex) : "";
    const renamedFileName = `${displayName}${extension}`;
    return new File([file], renamedFileName, {
      type: file.type,
      lastModified: file.lastModified,
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setNote("");
      setUseTemplate(false);
      setSelectedFile(null);
      setSelectedTemplate("");
      setFileError("");
      setPreviewUrl("");
      setPreviewTitle("");
      setPreviewOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const nextFile = e.target.files[0];
      if (!nextFile.name.toLowerCase().endsWith(".docx")) {
        setSelectedFile(null);
        setFileError("Only Microsoft Word (.docx) files are accepted for revision source files.");
        e.target.value = "";
        return;
      }
      if (nextFile.size > maxFileSizeBytes) {
        setSelectedFile(null);
        setFileError(
          `Selected file exceeds the maximum allowed size of ${maxFileSizeMB} MB.`,
        );
        return;
      }
      setFileError("");
      setSelectedFile(nextFile);
    }
  };

  const openPreview = async (revisionId: string, title: string, previewVersionToken?: string | null) => {
    try {
      const cacheBuster = previewVersionToken?.trim()
        ? previewVersionToken
        : buildPreviewCacheBuster(revisionId, title, selectedTemplate, selectedFile?.name, selectedFile?.lastModified);
      const previewFile = await loadPdfPreviewFile(
        () => documentApi.previewRevisionFile(revisionId, cacheBuster),
        `${title}.pdf`,
      );
      const url = URL.createObjectURL(previewFile);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPreviewTitle(title);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Failed to preview template", error);
    }
  };

  const templateSearch = async (query: string): Promise<SelectOption[]> => {
    const response = await documentApi.getSelectableTemplates({
      search: query || undefined,
      documentType: documentTypeShortCode || documentType || undefined,
      subType: documentSubType || undefined,
      limit: 50,
      sortBy: "created",
      sortDirection: "desc",
    });

    return (response || []).flatMap((item: any) => {
      const revisionId = item.currentEffectiveRevisionId || item.id;
      if (!revisionId) {
        return [];
      }

      const label = buildTemplateLabel({
        documentNumber: item.documentNumber || "N/A",
        revisionNumber: item.currentEffectiveRevisionNumber || item.revisionNumber || "N/A",
        documentName:
          item.documentName || item.revisionName || item.title || "Template",
      });
      const previewVersionToken = (item as any).previewVersionToken || null;

      return [
        {
          label,
          value: revisionId,
          icon: (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                void openPreview(revisionId, label, previewVersionToken);
              }}
              title="Preview template"
            >
              <Eye className="h-4 w-4" />
            </Button>
          ),
        } satisfies SelectOption,
      ];
    });
  };

  const handleConfirm = () => {
    if (useTemplate && selectedTemplate) {
      onConfirm(null, note, true, selectedTemplate);
      return;
    }

    if (selectedFile) {
      if (selectedFile.size > maxFileSizeBytes) {
        setFileError(
          `Selected file exceeds the maximum allowed size of ${maxFileSizeMB} MB.`,
        );
        return;
      }
      onConfirm(renameUploadedFile(selectedFile), note, false);
    }
  };

  const handleClose = () => {
    setNote("");
    setUseTemplate(false);
    setSelectedFile(null);
    setSelectedTemplate("");
    setFileError("");
    onClose();
  };

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Upload Revision"
        confirmText="OK"
        cancelText="Cancel"
        size="lg"
        isLoading={isSubmitting}
        confirmDisabled={!hasFileOrTemplate || Boolean(fileError)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={displayName}
              readOnly
              className={CONTROL_STATE_CLASSES.readonlyField}
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Note: The uploaded file will be renamed to the name above
            </p>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Revision Number
            </label>
            <input
              type="text"
              value={revisionNumber}
              readOnly
              className={CONTROL_STATE_CLASSES.readonlyField}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter notes about this revision..."
              rows={4}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
            />
          </div>

          {canUseTemplate && <div className="space-y-3">
            <Checkbox
              id="use-template"
              checked={useTemplate}
              onChange={(checked) => {
                setUseTemplate(checked);
                setSelectedTemplate("");
                setSelectedFile(null);
                setFileError("");
              }}
              label="Select file from template"
            />

            {useTemplate && (
              <div className="space-y-2">
                <Select
                  label="Document Template"
                  value={selectedTemplate}
                  onChange={setSelectedTemplate}
                  options={[]}
                  placeholder="Select a published template..."
                  enableSearch={true}
                  onSearch={templateSearch}
                  debounceMs={300}
                  minSearchLength={0}
                />
                <p className="text-xs text-slate-500">
                  Files can be selected only from active published templates with
                  an effective revision, a stored file, and the same Document Type
                </p>
              </div>
            )}
          </div>}

          {!useTemplate && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 w-full">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full sm:w-auto flex-shrink-0 whitespace-nowrap"
                >
                  <Upload className="h-4 w-4" />
                  Choose File
                </Button>
                <span className="text-sm text-slate-600 truncate block">
                  {selectedFile ? selectedFile.name : "No file chosen"}
                </span>
              </div>
                <p className="text-xs text-slate-500 mt-1">
                  Maximum file size: {maxFileSizeMB} MB
                </p>
              {fileError && (
                <p className="text-xs text-red-600 mt-1">{fileError}</p>
              )}
            </div>
          )}
        </div>
      </FormModal>

      <FormModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Template Preview"
        confirmText="Close"
        showCancel={false}
        onConfirm={() => setPreviewOpen(false)}
        size="xl"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <FileText className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">{previewTitle || "Template"}</span>
          </div>
          {previewUrl ? (
            <iframe
              title="Template Preview"
              src={previewUrl}
              className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <div className="h-[40vh] flex items-center justify-center text-slate-400">
              No preview available
            </div>
          )}
        </div>
      </FormModal>
    </>
  );
};
