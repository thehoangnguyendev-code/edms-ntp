import React from "react";
import {
  Check,
  CloudUpload,
  Link2,
  X,
} from "lucide-react";
import { IconRefresh } from "@tabler/icons-react";
import { cn } from "@/components/ui/utils";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { Progress } from "@/components/ui";
import { getFileIconSrc } from "@/utils/fileIcons";
import type {
  MaterialUploadMode,
  MaterialUploadedFile,
  MaterialWorkflowFormData,
  MaterialRevisionFormData,
  TrainingMaterialWorkflow,
} from "@/features/training/materials/types";

const FILE_UPLOAD_ACCEPT = ".pdf,.mp4,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

interface MaterialEditorUploadTabProps {
  mode: "upload" | "edit";
  uploadMode: MaterialUploadMode;
  uploadModeTabs: TabItem[];
  setUploadMode: (mode: MaterialUploadMode) => void;
  existingData?: { existingFile: { name: string; size: number } };
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelect: (files: FileList | null) => void;
  uploadedFile: MaterialUploadedFile | null;
  newFile: MaterialUploadedFile | null;
  isReplacingFile: boolean;
  setIsReplacingFile: React.Dispatch<React.SetStateAction<boolean>>;
  isDragActive: boolean;
  handleDragOver: (event: React.DragEvent) => void;
  handleDragLeave: (event: React.DragEvent) => void;
  handleDrop: (event: React.DragEvent) => void;
  removeUploadedFile: () => void;
  removeReplacementFile: () => void;
  formData: MaterialWorkflowFormData;
  updateField: (key: keyof MaterialWorkflowFormData, value: any) => void;
  isValidUrl: (url: string) => boolean;
  handleAddLink: () => void;
}

export const MaterialEditorUploadTab: React.FC<MaterialEditorUploadTabProps> = ({
  mode,
  uploadMode,
  uploadModeTabs,
  setUploadMode,
  existingData,
  fileInputRef,
  handleFileSelect,
  uploadedFile,
  newFile,
  isReplacingFile,
  setIsReplacingFile,
  isDragActive,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  removeUploadedFile,
  removeReplacementFile,
  formData,
  updateField,
  isValidUrl,
  handleAddLink,
}) => {
  const getEditorFileTypeLabel = (name: string): "PDF" | "Video" | "Image" | "Document" => {
    const ext = name.toLowerCase().split(".").pop();
    switch (ext) {
      case "pdf": return "PDF";
      case "mp4": return "Video";
      case "jpg":
      case "jpeg":
      case "png": return "Image";
      default: return "Document";
    }
  };

  const formatEditorFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const renderUploadModeCard = () => {
    if (mode === "edit") {
      return (
        <>
          {!isReplacingFile && !newFile && existingData && (
            <div className="border border-emerald-200 rounded-xl p-4 md:p-5 bg-emerald-50/40">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <img
                    src={getFileIconSrc(existingData.existingFile.name)}
                    alt="file icon"
                    className="h-6 w-6 object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {existingData.existingFile.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatEditorFileSize(existingData.existingFile.size)} · {getEditorFileTypeLabel(existingData.existingFile.name)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-600">Current file</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsReplacingFile(true);
                  setTimeout(() => fileInputRef.current?.click(), 50);
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
              >
                <IconRefresh className="h-3.5 w-3.5" />
                Replace with a different file
              </button>
            </div>
          )}

          {isReplacingFile && !newFile && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 min-h-[220px]",
                isDragActive
                  ? "border-emerald-500 bg-emerald-50/50"
                  : "border-slate-300 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/30",
              )}
            >
              <div
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors",
                  isDragActive ? "bg-emerald-100" : "bg-slate-100",
                )}
              >
                <CloudUpload
                  className={cn(
                    "h-7 w-7",
                    isDragActive ? "text-emerald-600" : "text-slate-400",
                  )}
                />
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-700 text-center">
                {isDragActive ? "Drop replacement file here" : "Drag & drop a replacement file"}
              </p>
              <p className="text-xs text-slate-500 mt-1">or click to browse</p>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setIsReplacingFile(false);
                }}
                className="mt-4 text-xs text-slate-500 hover:text-slate-700 underline transition-colors"
              >
                Keep current file
              </button>
            </div>
          )}

          {newFile && (
            <div className="space-y-3">
              <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                    <img
                      src={getFileIconSrc(newFile.name)}
                      alt="file icon"
                      className="h-6 w-6 object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{newFile.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatEditorFileSize(newFile.size)} · {getEditorFileTypeLabel(newFile.name)}
                    </p>
                    {newFile.status === "uploading" && (
                      <div className="mt-2">
                        <Progress value={newFile.progress} size="xs" variant="success" animated />
                        <p className="text-xs text-slate-500 mt-1">{newFile.progress}% uploaded</p>
                      </div>
                    )}
                    {newFile.status === "success" && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-xs font-medium text-emerald-600">Ready to replace</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={removeReplacementFile}
                    className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Cancel replacement"
                  >
                    <X className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
              </div>
              {existingData && (
                <p className="text-xs text-slate-500">
                  Replacing: <span className="font-medium text-slate-700">{existingData.existingFile.name}</span> → <span className="font-medium text-emerald-700">{newFile.name}</span>
                </p>
              )}
            </div>
          )}
        </>
      );
    }

    if (!uploadedFile) {
      return (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 min-h-[220px]",
            isDragActive
              ? "border-emerald-500 bg-emerald-50/50"
              : "border-slate-300 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/30",
          )}
        >
          <div
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors",
              isDragActive ? "bg-emerald-100" : "bg-slate-100",
            )}
          >
            <CloudUpload className={cn("h-7 w-7", isDragActive ? "text-emerald-600" : "text-slate-400")} />
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-700 text-center">
            {isDragActive ? "Drop your file here" : "Drag & drop your file here"}
          </p>
          <p className="text-2xs text-slate-400 mt-1.5 text-center px-4">
            Supports: PDF, Video (MP4), Images, Office (DOCX, XLSX, PPTX)
          </p>
          <p className="text-xs text-slate-500 mt-2">or click to browse</p>
        </div>
      );
    }

    return (
      <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-slate-50/50">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
            <img
              src={getFileIconSrc(uploadedFile.name)}
              alt="file icon"
              className="h-6 w-6 object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{uploadedFile.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatEditorFileSize(uploadedFile.size)} · {getEditorFileTypeLabel(uploadedFile.name)}
            </p>
            {uploadedFile.status === "uploading" && (
              <div className="mt-2">
                <div className="mt-2">
                  <Progress value={uploadedFile.progress} size="sm" />
                </div>
                <p className="text-xs text-slate-500 mt-1">{uploadedFile.progress}% uploaded</p>
              </div>
            )}
            {uploadedFile.status === "success" && (
              <div className="flex items-center gap-1.5 mt-2">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-600">Upload complete</span>
              </div>
            )}
          </div>
          <button
            onClick={removeUploadedFile}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-200 transition-colors"
            title="Remove file"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {uploadedFile.status === "success" && (
          <button
            onClick={() => {
              removeUploadedFile();
              setTimeout(() => fileInputRef.current?.click(), 100);
            }}
            className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
          >
            Replace with another file
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <TabNav
        tabs={uploadModeTabs}
        activeTab={uploadMode}
        onChange={(tabId) => setUploadMode(tabId as MaterialUploadMode)}
        variant="pill"
        className="mb-4"
        layoutId={`uploadModeTabIndicator-${mode}`}
      />

      {uploadMode === "file" && renderUploadModeCard()}

      {uploadMode === "link" && (
        <div className="space-y-3">
          <div className="border-2 border-dashed rounded-xl p-4 md:p-5 flex flex-col items-center justify-center border-slate-300 bg-slate-50/50">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-slate-100">
              <Link2 className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-700 text-center mb-3">
              Paste external resource URL
            </p>
            <div className="w-full flex items-center gap-2">
              <input
                type="url"
                value={formData.externalUrl}
                onChange={(event) => updateField("externalUrl", event.target.value)}
                onBlur={handleAddLink}
                placeholder="https://example.com/training-document.pdf"
                className="flex-1 h-9 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm placeholder:text-slate-400"
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Supports any URL: YouTube, Google Drive, SharePoint, web pages, etc.
            </p>
          </div>

          {formData.externalUrl && isValidUrl(formData.externalUrl) && (
            <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-slate-50/50">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                  <Link2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {formData.externalUrl}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">External Link</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-600">Valid URL</span>
                  </div>
                </div>
                <button
                  onClick={() => updateField("externalUrl", "")}
                  className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                  title="Remove link"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_UPLOAD_ACCEPT}
        onChange={(event) => handleFileSelect(event.target.files)}
        className="hidden"
      />
    </div>
  );
};

interface MaterialRevisionUploadTabProps {
  source: {
    existingFile: { name: string; size: number };
    form: { version: string };
  };
  uploadMode: MaterialUploadMode;
  uploadTabs: TabItem[];
  setUploadMode: (mode: MaterialUploadMode) => void;
  keepExistingFile: boolean;
  setKeepExistingFile: React.Dispatch<React.SetStateAction<boolean>>;
  newFile: MaterialUploadedFile | null;
  setNewFile: React.Dispatch<React.SetStateAction<MaterialUploadedFile | null>>;
  isDragActive: boolean;
  handleDragOver: (event: React.DragEvent) => void;
  handleDragLeave: (event: React.DragEvent) => void;
  handleDrop: (event: React.DragEvent) => void;
  handleFileSelect: (files: FileList | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  formData: MaterialRevisionFormData;
  updateField: (key: keyof MaterialRevisionFormData, value: any) => void;
  isValidUrl: (url: string) => boolean;
  formatFileSize: (bytes: number) => string;
  getFileTypeLabel: (name: string) => string;
}

export const MaterialRevisionUploadTab: React.FC<MaterialRevisionUploadTabProps> = ({
  source,
  uploadMode,
  uploadTabs,
  setUploadMode,
  keepExistingFile,
  setKeepExistingFile,
  newFile,
  setNewFile,
  isDragActive,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileSelect,
  fileInputRef,
  formData,
  updateField,
  isValidUrl,
  formatFileSize,
  getFileTypeLabel,
}) => {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-xs text-slate-500 px-1">
          Keep the existing file or upload a new one for this revision.
        </p>

        <TabNav
          tabs={uploadTabs}
          activeTab={uploadMode}
          onChange={(tabId) => {
            setUploadMode(tabId as MaterialUploadMode);
            setNewFile(null);
            setKeepExistingFile(true);
          }}
          variant="pill"
          className="mb-4"
          layoutId="upgradeRevisionUploadModeTabIndicator"
        />

        {uploadMode === "file" && (
          <>
            {keepExistingFile && !newFile && (
              <div className="border border-emerald-200 rounded-xl p-4 md:p-5 bg-emerald-50/40">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0">
                    <img
                      src={getFileIconSrc(source.existingFile.name)}
                      alt="existing file"
                      className="h-6 w-6 object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {source.existingFile.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatFileSize(source.existingFile.size)} ·{" "}
                      {getFileTypeLabel(source.existingFile.name)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-600">
                        Carrying over from v{source.form.version}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setKeepExistingFile(false);
                    setTimeout(() => fileInputRef.current?.click(), 50);
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
                >
                  <IconRefresh className="h-3.5 w-3.5" />
                  Replace with a new file
                </button>
              </div>
            )}

            {!keepExistingFile && !newFile && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 min-h-[220px]",
                  isDragActive
                    ? "border-emerald-500 bg-emerald-50/50"
                    : "border-slate-300 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/30",
                )}
              >
                <div
                  className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors",
                    isDragActive ? "bg-emerald-100" : "bg-slate-100",
                  )}
                >
                  <CloudUpload className={cn("h-7 w-7", isDragActive ? "text-emerald-600" : "text-slate-400")} />
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-700 text-center">
                  {isDragActive ? "Drop revision file here" : "Drag & drop a new file for revision"}
                </p>
                <p className="text-2xs text-slate-400 mt-1.5 text-center px-4">
                  Supports: PDF, Video (MP4), Images, Office (DOCX, XLSX, PPTX)
                </p>
                <p className="text-xs text-slate-500 mt-2">or click to browse</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setKeepExistingFile(true);
                  }}
                  className="mt-4 text-xs text-slate-500 hover:text-slate-700 underline transition-colors"
                >
                  Keep existing file
                </button>
              </div>
            )}

            {newFile && (
              <div className="space-y-3">
                <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-slate-50/50">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                      <img
                        src={getFileIconSrc(newFile.name)}
                        alt="new file"
                        className="h-6 w-6 object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{newFile.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatFileSize(newFile.size)} · {getFileTypeLabel(newFile.name)}
                      </p>
                      {newFile.status === "uploading" && (
                        <div className="mt-2">
                          <Progress value={newFile.progress} size="xs" variant="success" animated />
                          <p className="text-xs text-slate-500 mt-1">{newFile.progress}% uploaded</p>
                        </div>
                      )}
                      {newFile.status === "success" && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-xs font-medium text-emerald-600">New file ready</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setNewFile(null)}
                      className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      <X className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Replacing v{source.form.version} file:{" "}
                  <span className="font-medium text-slate-700">{source.existingFile.name}</span>
                </p>
              </div>
            )}
          </>
        )}

        {uploadMode === "link" && (
          <div className="space-y-3">
            <div className="border-2 border-dashed rounded-xl p-4 md:p-5 flex flex-col items-center justify-center border-slate-300 bg-slate-50/50">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-slate-100">
                <Link2 className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-700 text-center mb-3">
                Update external resource URL
              </p>
              <div className="w-full">
                <input
                  type="url"
                  value={formData.externalUrl}
                  onChange={(e) => updateField("externalUrl", e.target.value)}
                  placeholder="https://example.com/new-training-resource"
                  className="w-full h-9 px-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm placeholder:text-slate-400"
                />
              </div>
            </div>

            {formData.externalUrl && isValidUrl(formData.externalUrl) && (
              <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                    <Link2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {formData.externalUrl}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">External Link</p>
                  </div>
                  <button
                    onClick={() => updateField("externalUrl", "")}
                    className="p-1 rounded-lg hover:bg-slate-200"
                  >
                    <X className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_UPLOAD_ACCEPT}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
      </div>
    </div>
  );
};

export const MaterialReadOnlyUploadTab: React.FC<{ material: TrainingMaterialWorkflow }> = ({
  material,
}) => (
  <div className="space-y-4">
    {material.externalUrl ? (
      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-600">
          <Link2 className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{material.externalUrl}</p>
          <p className="text-xs text-slate-500 mt-0.5">External Resource Link</p>
        </div>
        <a
          href={material.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
        >
          Open Link <Check className="h-3 w-3" />
        </a>
      </div>
    ) : (
      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
          <img
            src={getFileIconSrc(material.title || "file.pdf")}
            alt="file"
            className="h-8 w-8 object-contain"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {material.title || "Training_Material.pdf"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {material.fileSize || "2.4 MB"} · PDF Document
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors">
            Download
          </button>
          <button className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 flex items-center gap-1.5 transition-colors">
            View
          </button>
        </div>
      </div>
    )}
  </div>
);
