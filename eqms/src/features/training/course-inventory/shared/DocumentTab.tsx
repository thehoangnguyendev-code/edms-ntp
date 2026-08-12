import React, { useState, useCallback, useEffect } from "react";
import { Trash2, Eye, Download, Library, Check, X } from "lucide-react";
import { Textarea } from "@/components/ui/form/ResponsiveForm";
import { Button } from "@/components/ui/button/Button";
import { Progress } from "@/components/ui";
import { SelectFromLibraryModal, type LibraryItem } from "../courses/components/SelectFromLibraryModal";
import { TrainingFile } from "../../types";

import { getFileIconSrc, defaultFileIcon } from "@/utils/fileIcons";
import { IconFolderOpen } from "@tabler/icons-react";

interface DocumentTrainingTabProps {
    readOnly?: boolean;
    trainingFiles: TrainingFile[];
    setTrainingFiles?: React.Dispatch<React.SetStateAction<TrainingFile[]>>;
    instruction: string;
    setInstruction?: (v: string) => void;
}


const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/* ─── Library Mock Data ─────────────────────────────────────────── */
const LIBRARY_MATERIALS: LibraryItem[] = [
    { id: "lib-1", code: "MAT-2026-001", title: "GMP Introduction Video", fileName: "GMP_Introduction_2026.mp4", type: "Video", fileSize: 131072000, category: "GMP", status: "Effective" },
    { id: "lib-2", code: "MAT-2026-002", title: "Cleanroom Operations Manual", fileName: "Cleanroom_Operations_Manual.pdf", type: "PDF", fileSize: 4718592, category: "Technical", status: "Effective" },
    { id: "lib-3", code: "MAT-2026-003", title: "Equipment Handling Guide", fileName: "Equipment_Handling_Guide.pdf", type: "PDF", fileSize: 8597504, category: "Technical", status: "Pending Review" },
    { id: "lib-4", code: "MAT-2026-004", title: "Safety Protocol Infographic", fileName: "Safety_Protocol_Infographic.png", type: "Image", fileSize: 2202009, category: "Safety", status: "Effective" },
    { id: "lib-5", code: "MAT-2026-005", title: "ISO 9001 Training Video", fileName: "ISO9001_Training_2026.mp4", type: "Video", fileSize: 220200960, category: "Compliance", status: "Draft" },
    { id: "lib-6", code: "MAT-2026-006", title: "SOP Template Pack", fileName: "SOP_Templates_v3.docx", type: "Document", fileSize: 1048576, category: "SOP", status: "Effective" },
    { id: "lib-7", code: "MAT-2026-007", title: "Chemical Handling Procedures", fileName: "Chemical_Handling_Procedures.pdf", type: "PDF", fileSize: 3145728, category: "Safety", status: "Obsoleted" },
    { id: "lib-8", code: "MAT-2026-008", title: "HPLC Training Slides", fileName: "HPLC_Training_Slides.pptx", type: "Document", fileSize: 15728640, category: "Technical", status: "Effective" },
    { id: "lib-11", code: "MAT-2026-011", title: "Batch Record Review Checklist", fileName: "Batch_Record_Review_Checklist.docx", type: "Document", fileSize: 838860, category: "Quality", status: "Pending Approval" },
];


export const DocumentTab: React.FC<DocumentTrainingTabProps> = ({
    readOnly = false,
    trainingFiles,
    setTrainingFiles,
    instruction,
    setInstruction,
}) => {
    // Defensive check for trainingFiles
    const safeFiles = trainingFiles || [];

    const [showLibraryModal, setShowLibraryModal] = useState(false);

    const handleLibrarySelect = useCallback((materials: LibraryItem[]) => {
        if (!setTrainingFiles) return;
        const newFiles: TrainingFile[] = materials.map((m) => ({
            id: `lib-${m.id}-${Date.now()}`,
            file: new File([], m.fileName),
            name: m.fileName,
            size: m.fileSize,
            type: m.type === "PDF" ? "application/pdf" : m.type === "Video" ? "video/mp4" : "application/octet-stream",
            progress: 0,
            status: "uploading" as const,
        }));
        setTrainingFiles((prev) => [...prev, ...newFiles]);
    }, [setTrainingFiles]);

    // Simulate upload progress
    const uploadingIds = safeFiles
        .filter(f => f.status === "uploading")
        .map(f => f.id)
        .join(",");

    useEffect(() => {
        if (!uploadingIds || !setTrainingFiles) return;

        const timer = setInterval(() => {
            setTrainingFiles(prev => {
                const hasUploading = prev.some(f => f.status === "uploading");
                if (!hasUploading) {
                    clearInterval(timer);
                    return prev;
                }

                return prev.map(f => {
                    if (f.status !== "uploading") return f;

                    // Increment progress randomly between 8 and 18
                    const nextProgress = f.progress + Math.floor(Math.random() * 11) + 8;
                    if (nextProgress >= 100) {
                        return {
                            ...f,
                            progress: 100,
                            status: "success" as const
                        };
                    }
                    return {
                        ...f,
                        progress: nextProgress
                    };
                });
            });
        }, 200);

        return () => clearInterval(timer);
    }, [uploadingIds, setTrainingFiles]);

    const removeFile = (id: string) => {
        setTrainingFiles?.(prev => prev.filter(f => f.id !== id));
    };

    // ─── Read-Only Mode ────────────────────────────────────────────
    if (readOnly) {
        return (
            <div className="p-4 md:p-5 space-y-6">
                {/* Training Files */}
                <div className="space-y-4">
                    {safeFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                                <Library className="h-6 w-6 text-slate-300" />
                            </div>
                            <p className="text-sm font-medium text-slate-900">No training materials selected</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Training documents will appear here once selected from the library.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs sm:text-sm font-medium text-slate-700">
                                    {safeFiles.length} file{safeFiles.length > 1 ? "s" : ""} selected
                                </p>
                            </div>
                            <div className="space-y-2">
                                {safeFiles.map((file) => (
                                    <div
                                        key={file.id}
                                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                                    >
                                        <img
                                            src={getFileIconSrc(file.name)}
                                            alt=""
                                            className="h-10 w-10 object-contain"
                                            onError={(e) => { (e.target as HTMLImageElement).src = defaultFileIcon; }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                                            <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-slate-200 transition-colors"
                                                title="Preview"
                                            >
                                                <Eye className="h-4 w-4 text-slate-600" />
                                            </button>
                                            <button
                                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-slate-200 transition-colors"
                                                title="Download"
                                            >
                                                <Download className="h-4 w-4 text-slate-600" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Instruction (read-only) */}
                {instruction && (
                    <div className="border-t border-slate-200 pt-6">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs sm:text-sm font-medium text-slate-700">
                                Instruction
                            </label>
                            <Textarea
                                value={instruction}
                                readOnly
                                rows={4}
                                className="text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ─── Edit Mode ─────────────────────────────────────────────────

    return (
        <div className="p-4 md:p-5 space-y-6">
            {/* Section Header */}
            <div>
                <h3 className="text-base font-semibold text-slate-900">Select Training Materials</h3>
                <p className="text-xs text-slate-500 mt-1">Select SOP documents, presentation slides, or training videos for this course from the shared materials library.</p>
            </div>

            <div className="flex items-center gap-3">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-10 px-4 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    onClick={() => setShowLibraryModal(true)}
                >
                    <IconFolderOpen className="h-4 w-4 mr-2 text-emerald-500" />
                    Select from Materials Library
                </Button>
            </div>


            {/* File List */}
            {safeFiles.length > 0 && (
                <div>
                    <h4 className="text-xs sm:text-sm font-medium text-slate-700 mb-2">Selected Materials ({safeFiles.length})</h4>
                    <div className="space-y-2">
                        {safeFiles.map(file => (
                            <div
                                key={file.id}
                                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 group hover:bg-slate-100 transition-colors"
                            >
                                {/* File Icon */}
                                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                                    <img
                                        src={getFileIconSrc(file.name)}
                                        alt="file icon"
                                        className="h-7 w-7 object-contain"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                    />
                                </div>

                                {/* File Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs sm:text-sm font-medium text-slate-700 truncate">{file.name}</p>
                                    
                                    {file.status === "uploading" ? (
                                        <div className="mt-1.5 space-y-1">
                                            <div className="flex items-center justify-between text-2xs text-slate-400 font-medium">
                                                <span>{formatFileSize(file.size)}</span>
                                                <span className="text-emerald-600 font-semibold animate-pulse">
                                                    Uploading... {file.progress}%
                                                </span>
                                            </div>
                                            <Progress value={file.progress} size="xs" variant="success" animated />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-slate-400">{formatFileSize(file.size)}</span>
                                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                                <Check className="h-3 w-3 stroke-[3]" />
                                                Selected
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions (Cancel or Remove) */}
                                {file.status === "uploading" ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeFile(file.id);
                                        }}
                                        className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        aria-label="Cancel upload"
                                        title="Cancel upload"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeFile(file.id);
                                        }}
                                        className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        aria-label="Remove file"
                                        title="Remove file"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Instruction / Notes */}
            <div className="border-t border-slate-200 pt-6">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs sm:text-sm font-medium text-slate-700">
                        Instruction
                    </label>
                    <Textarea
                        value={instruction}
                        onChange={(e) => setInstruction?.(e.target.value)}
                        rows={4}
                        className="text-sm"
                        placeholder="e.g., Focus on Chapter 3 – Cleaning Validation Procedures. Pay special attention to Appendix B for equipment handling."
                    />
                    <p className="text-xs text-slate-500">Provide notes to help employees focus on specific sections or key points in the training materials.</p>
                </div>
            </div>

            {/* Library Modal */}
            <SelectFromLibraryModal
                isOpen={showLibraryModal}
                onClose={() => setShowLibraryModal(false)}
                onSelect={handleLibrarySelect}
                items={LIBRARY_MATERIALS}
                excludeFileNames={safeFiles.map((f) => f.name)}
            />

        </div>
    );
};
