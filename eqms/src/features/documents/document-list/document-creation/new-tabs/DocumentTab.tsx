import React, { useState, useRef } from "react";
import { File, CheckCircle2, AlertCircle, Check, AlertTriangle } from "lucide-react";
import { IconCloudUpload } from "@tabler/icons-react";
import { cn } from "@/components/ui/utils";
import { getFileIconSrc } from "@/utils/fileIcons";
import filePlaceholder from "@/assets/images/image-file/file.png";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import type { ParentDocument, RelatedDocument } from "./subtabs/types";

export interface UploadedFile {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
}

interface DocumentTabProps {
  uploadedFiles: UploadedFile[];
  onFilesChange: (
    files: UploadedFile[] | ((prev: UploadedFile[]) => UploadedFile[]),
  ) => void;
  selectedFile: File | null;
  onSelectFile: (file: File | null) => void;
  maxFiles?: number; // Maximum number of files allowed (undefined = unlimited)
  isObsoleted?: boolean; // Disable all file operations when obsoleted
  hideUpload?: boolean; // Hide upload section and show "no attachment" message
  // Optional extended props for document relationships
  correlatedDocuments?: ParentDocument[];
  onCorrelatedDocumentsChange?: (docs: ParentDocument[]) => void;
  relatedDocuments?: RelatedDocument[];
  onRelatedDocumentsChange?: (docs: RelatedDocument[]) => void;
  documentType?: string;
  onSuggestedCodeChange?: (code: string) => void;
}

interface FilePreviewProps {
  file?: File | null;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file }) => {
  const [fileUrl, setFileUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) {
      setFileUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setFileUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!file) {
    return (
      <div
        className="w-full flex items-center justify-center h-full text-slate-400 text-xs md:text-sm"
        style={{ height: "calc(100vh - 180px)", minHeight: "720px" }}
      >
        There is no file available for preview.
      </div>
    );
  }

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage =
    file.type.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);

  if (isPdf) {
    return (
      fileUrl ? <DocumentPdfViewer fileUrl={fileUrl} withFrame={false} /> : null
    );
  }

  if (isImage) {
    return (
      <div
        className="w-full h-full flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl overflow-auto p-4"
        style={{ height: "calc(100vh - 180px)", minHeight: "720px" }}
      >
        {fileUrl && (
          <img
            src={fileUrl}
            alt={file.name}
            className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
          />
        )}
      </div>
    );
  }

  return (
      <div className="w-full min-h-0" style={{ height: "calc(100vh - 180px)", minHeight: "720px" }}>
        <div className="flex flex-col items-center justify-center h-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-4 md:p-5">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <p className="text-slate-700 font-semibold mb-2">Detailed Preview Unavailable</p>
        <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6">
          Only PDF files or images can be previewed in-browser. Please download this file to view its contents.
        </p>
        <div className="flex flex-col items-center p-4 md:p-5 bg-white rounded-lg border border-slate-200">
          <img src={filePlaceholder} alt="File" className="h-16 w-16 mb-2 opacity-50" />
          <span className="text-xs font-medium text-slate-900">{file.name}</span>
        </div>
      </div>
    </div>
  );
};

export const DocumentTab: React.FC<DocumentTabProps> = ({
  uploadedFiles,
  selectedFile,
  onSelectFile,
  isObsoleted = false,
  hideUpload = false,
  // Extended props (unused in this component but accepted for compatibility)
  correlatedDocuments: _correlatedDocuments,
  onCorrelatedDocumentsChange: _onCorrelatedDocumentsChange,
  relatedDocuments: _relatedDocuments,
  onRelatedDocumentsChange: _onRelatedDocumentsChange,
  documentType: _documentType,
  onSuggestedCodeChange: _onSuggestedCodeChange,
}) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Show "No attachment" message when hideUpload is true */}
      {hideUpload ? (
        <div className="border-2 border-dashed rounded-xl flex items-center justify-center bg-slate-50">
          <div className="text-center p-4 md:p-5">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <File className="h-8 w-8 text-slate-400" />
            </div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">
              There is no attachment to display
            </h4>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-4 md:space-y-6">
            {uploadedFiles.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">
                  Available Files ({uploadedFiles.length})
                </h4>

                <div className="grid grid-cols-1 gap-3">
                  {uploadedFiles.map((uploadedFile) => (
                    <button
                      key={uploadedFile.id}
                      type="button"
                      className={cn(
                        "w-full text-left bg-white border rounded-lg p-3 transition-all hover:shadow-md",
                        selectedFile === uploadedFile.file
                          ? "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/30"
                          : "border-slate-200 hover:border-emerald-500/50",
                      )}
                      onClick={() => onSelectFile(uploadedFile.file)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 flex items-center justify-center shrink-0">
                          {(() => {
                            const iconSrc = getFileIconSrc(uploadedFile.file.name);
                            return (
                              <img
                                src={iconSrc}
                                alt="file icon"
                                className="h-7 w-7 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            );
                          })()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {uploadedFile.file.name}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {formatFileSize(uploadedFile.file.size)}
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              {uploadedFile.status === "success" && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              )}
                              {uploadedFile.status === "error" && (
                                <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                              )}
                            </div>
                          </div>

                          {uploadedFile.status === "uploading" && (
                            <div className="mt-1.5">
                              <div className="flex items-center justify-between text-xs text-slate-500 mb-0.5">
                                <span>Uploading...</span>
                                <span>{uploadedFile.progress}%</span>
                              </div>
                              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                                  style={{ width: `${uploadedFile.progress}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="h-[720px]">
              {(() => {
                const selected = uploadedFiles.find((f) => f.file === selectedFile);

                if (!selectedFile || !selected) {
                  return (
                    <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl bg-slate-50">
                      <div className="text-center p-4 md:p-5">
                        <File className="h-12 w-12 md:h-16 md:w-16 text-slate-300 mx-auto mb-3 md:mb-4" />
                        <p className="text-slate-500 font-medium text-sm md:text-base">
                          No file selected
                        </p>
                        <p className="text-xs md:text-sm text-slate-400 mt-1.5 md:mt-2">
                          Select a file above to preview
                        </p>
                      </div>
                    </div>
                  );
                }

                if (selected.status !== "success") {
                  return (
                    <div className="h-full flex items-center justify-center border rounded-xl bg-slate-50">
                      <div className="text-center p-4 md:p-5">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                          {selected.status === "uploading" ? (
                            <Check className="h-6 w-6 text-slate-400 animate-pulse" />
                          ) : (
                            <AlertCircle className="h-6 w-6 text-slate-400" />
                          )}
                        </div>
                        <p className="text-sm text-slate-600">
                          {selected.status === "uploading" && "Uploading file..."}
                          {selected.status === "error" && "File upload failed"}
                        </p>
                      </div>
                    </div>
                  );
                }

                return <FilePreview file={selectedFile} />;
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

