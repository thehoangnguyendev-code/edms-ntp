import React, { useState, useRef, useCallback } from "react";
import { Upload, Trash2, FileText, Lock, Download } from "lucide-react";
import { Select } from "@/components/ui/select/Select";
import { Input } from "@/components/ui/form/ResponsiveForm";
import { Badge } from "@/components/ui/badge/Badge";
import { cn } from "@/components/ui/utils";
import { FormSection } from "@/components/ui/form/FormSection";

import { getFileIconSrc, defaultFileIcon } from "@/utils/fileIcons";

import { UploadedFile } from "./workflow.types";

interface AssessmentConfigContentProps {
    readOnly?: boolean;
    // Edit mode props (UploadedFile objects)
    examTemplate?: UploadedFile | null;
    setExamTemplate?: (f: UploadedFile | null) => void;
    answerKey?: UploadedFile | null;
    setAnswerKey?: (f: UploadedFile | null) => void;
    // Read-only mode props (string filenames)
    examTemplateName?: string;
    answerKeyName?: string;
    // Shared data props
    passingGradeType: "pass_fail" | "score_10" | "percentage";
    setPassingGradeType?: (v: "pass_fail" | "score_10" | "percentage") => void;
    passingScore: number;
    setPassingScore?: (v: number) => void;
    maxAttempts: number;
    setMaxAttempts?: (v: number) => void;
}

const ACCEPTED_DOC_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPTED_DOC_EXTENSIONS = ".pdf,.doc,.docx";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FileUploadZone: React.FC<{
    label: string;
    description: string;
    file: UploadedFile | null;
    onFileSelect: (file: File) => void;
    onRemove: () => void;
    isRestricted?: boolean;
    required?: boolean;
}> = ({ label, description, file, onFileSelect, onRemove, isRestricted, required }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            if (!ACCEPTED_DOC_TYPES.includes(droppedFile.type)) {
                alert(`"${droppedFile.name}" is not a supported file type. Please upload PDF or Word documents.`);
                return;
            }
            if (droppedFile.size > MAX_FILE_SIZE) {
                alert(`"${droppedFile.name}" exceeds the 50MB size limit.`);
                return;
            }
            onFileSelect(droppedFile);
        }
    }, [onFileSelect]);

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!ACCEPTED_DOC_TYPES.includes(selectedFile.type)) {
                alert(`"${selectedFile.name}" is not supported. Please upload PDF or Word documents.`);
                return;
            }
            if (selectedFile.size > MAX_FILE_SIZE) {
                alert(`"${selectedFile.name}" exceeds the 50MB size limit.`);
                return;
            }
            onFileSelect(selectedFile);
            e.target.value = "";
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <label className="text-xs sm:text-sm font-medium text-slate-700">
                    {label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {isRestricted && (
                    <Badge color="amber" size="sm" pill icon={<Lock className="h-3 w-3" />}>
                        Admin/Reviewer only
                    </Badge>
                )}
            </div>
            <p className="text-xs text-slate-500">{description}</p>

            {file ? (
                <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-slate-50/50 group hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                            <img
                                src={getFileIconSrc(file.name)}
                                alt="file icon"
                                className="h-6 w-6 object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-500">{formatFileSize(file.size)}</span>
                                {file.status === "uploading" && (
                                    <span className="text-xs text-emerald-600 font-medium">{file.progress}%</span>
                                )}
                                {file.status === "success" && (
                                    <span className="text-xs text-emerald-600 font-medium">Uploaded</span>
                                )}
                            </div>
                            {file.status === "uploading" && (
                                <div className="w-full h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                        style={{ width: `${file.progress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onRemove}
                            className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-200 transition-colors opacity-0 group-hover:opacity-100"
                            title="Remove file"
                        >
                            <Trash2 className="h-4 w-4 text-slate-500 hover:text-red-600 transition-colors" />
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                        "relative flex flex-col items-center justify-center w-full min-h-[140px] border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 p-4 md:p-5",
                        isDragOver
                            ? "border-emerald-500 bg-emerald-50/50"
                            : "border-slate-300 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/30"
                    )}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_DOC_EXTENSIONS}
                        onChange={handleFileInputChange}
                        className="hidden"
                    />
                    <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors",
                        isDragOver ? "bg-emerald-100" : "bg-slate-100"
                    )}>
                        <Upload className={cn("h-6 w-6", isDragOver ? "text-emerald-600" : "text-slate-400")} />
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-slate-700 text-center">
                        {isDragOver ? "Drop your file here" : "Click to upload or drag & drop"}
                    </p>
                    <p className="text-2xs sm:text-xs font-normal text-slate-400 mt-1 flex items-center gap-1">Word or PDF (max 50MB)</p>
                </div>
            )}
        </div>
    );
};

export const AssessmentConfigContent: React.FC<AssessmentConfigContentProps> = ({
    readOnly = false,
    examTemplate,
    setExamTemplate,
    answerKey,
    setAnswerKey,
    examTemplateName,
    answerKeyName,
    passingGradeType,
    setPassingGradeType,
    passingScore,
    setPassingScore,
    maxAttempts,
    setMaxAttempts,
}) => {
    const simulateUpload = (file: File, setter: (f: UploadedFile | null) => void) => {
        const uploadedFile: UploadedFile = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            name: file.name,
            size: file.size,
            progress: 0,
            status: "uploading",
        };
        setter(uploadedFile);

        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 30 + 10;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setter({ ...uploadedFile, progress: 100, status: "success" });
            } else {
                setter({ ...uploadedFile, progress: Math.round(progress) });
            }
        }, 200);
    };

    const getPassingScoreLabel = () => {
        switch (passingGradeType) {
            case "pass_fail": return null;
            case "score_10": return "Minimum Passing Score (out of 10)";
            case "percentage": return "Minimum Passing Score (%)";
        }
    };

    const getPassingScoreMax = () => {
        switch (passingGradeType) {
            case "score_10": return 10;
            case "percentage": return 100;
            default: return 10;
        }
    };

    const passFailHint = (
        <div className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center overflow-hidden">
            <p className="text-sm text-slate-600 whitespace-nowrap text-ellipsis overflow-hidden">
                Trainer/Admin will mark each employee as <strong className="text-emerald-700">Pass</strong> or <strong className="text-red-700">Fail</strong> after grading.
            </p>
        </div>
    );

    // ─── Read-Only Mode ────────────────────────────────────────────
    if (readOnly) {
        return (
            <div className="space-y-6">
                {/* Exam Template & Answer Key */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormSection
                        title="Exam Template"
                        icon={<FileText className="h-4 w-4" />}
                        description="Materials used for assessment"
                    >
                        {examTemplateName ? (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <img
                                    src={getFileIconSrc(examTemplateName)}
                                    alt=""
                                    className="h-10 w-10 object-contain"
                                    onError={(e) => { (e.target as HTMLImageElement).src = defaultFileIcon; }}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 truncate">{examTemplateName}</p>
                                    <p className="text-xs text-slate-500">PDF Document</p>
                                </div>
                                <button
                                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-slate-200 transition-colors"
                                    title="Download"
                                >
                                    <Download className="h-4 w-4 text-slate-600" />
                                </button>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">No exam template uploaded</p>
                        )}
                    </FormSection>

                    <FormSection
                        title="Answer Key"
                        icon={<FileText className="h-4 w-4 text-amber-600" />}
                        description="Restricted reference for grading"
                        headerRight={
                            <Badge color="amber" size="sm" pill icon={<Lock className="h-3 w-3" />}>
                                Restricted
                            </Badge>
                        }
                    >
                        {answerKeyName ? (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <img
                                    src={getFileIconSrc(answerKeyName)}
                                    alt=""
                                    className="h-10 w-10 object-contain"
                                    onError={(e) => { (e.target as HTMLImageElement).src = defaultFileIcon; }}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 truncate">{answerKeyName}</p>
                                    <p className="text-xs text-slate-500">PDF Document</p>
                                </div>
                                <button
                                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-slate-200 transition-colors"
                                    title="Download"
                                >
                                    <Download className="h-4 w-4 text-slate-600" />
                                </button>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">No answer key uploaded</p>
                        )}
                    </FormSection>
                </div>

                {/* Passing Grade */}
                <div className="space-y-4 pt-4 border-t border-slate-100 mt-2">
                    <div>
                        <h4 className="text-sm font-semibold text-slate-900">Passing Grade</h4>
                        <p className="text-xs text-slate-500">Standard for assessment completion</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Grading Scale */}
                        <div>
                            <Select
                                label="Grading Scale"
                                value={passingGradeType}
                                onChange={() => { }}
                                disabled
                                options={[
                                    { label: "Pass / Fail", value: "pass_fail" },
                                    { label: "Score (out of 10)", value: "score_10" },
                                    { label: "Percentage (%)", value: "percentage" },
                                ]}
                            />
                        </div>

                        {/* Passing Score */}
                        {passingGradeType !== "pass_fail" && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs sm:text-sm font-medium text-slate-700">
                                    {getPassingScoreLabel()}
                                </label>
                                <Input
                                    type="number"
                                    value={passingScore}
                                    disabled
                                    onChange={() => { }}
                                    className="text-sm"
                                />
                                <p className="text-xs text-slate-500">
                                    {passingGradeType === "score_10"
                                        ? `Employees need at least ${passingScore}/10 to pass.`
                                        : `Employees need at least ${passingScore}% to pass.`}
                                </p>
                            </div>
                        )}

                        {passingGradeType === "pass_fail" && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs sm:text-sm font-medium text-transparent select-none">Placeholder</label>
                                {passFailHint}
                            </div>
                        )}

                        {/* Max Attempts */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs sm:text-sm font-medium text-slate-700">Max Attempts</label>
                            <Input
                                type="number"
                                value={maxAttempts}
                                disabled
                                onChange={() => { }}
                                className="text-sm"
                            />
                            <p className="text-xs text-slate-500">Maximum number of retake attempts allowed.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Edit Mode ─────────────────────────────────────────────────

    return (
        <div className="space-y-8">
            {/* Exam Template & Answer Key */}
            <div className="space-y-4">
                <div>
                    <h4 className="text-sm font-semibold text-slate-900">Assessment Materials</h4>
                    <p className="text-xs text-slate-500">Upload the exam paper and answer key reference.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FileUploadZone
                        label="Exam Template"
                        description="Upload the exam/quiz paper (Word or PDF) that will be printed and distributed to employees."
                        file={examTemplate || null}
                        onFileSelect={(file) => setExamTemplate && simulateUpload(file, setExamTemplate)}
                        onRemove={() => setExamTemplate?.(null)}
                        required
                    />

                    <FileUploadZone
                        label="Answer Key (Optional)"
                        description="Upload the answer key for grading reference. Only visible to Admin and Reviewer roles."
                        file={answerKey || null}
                        onFileSelect={(file) => setAnswerKey && simulateUpload(file, setAnswerKey)}
                        onRemove={() => setAnswerKey?.(null)}
                        isRestricted
                    />
                </div>
            </div>

            {/* Passing Grade */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
                <div>
                    <h4 className="text-sm font-semibold text-slate-900">Passing Grade</h4>
                    <p className="text-xs text-slate-500">Define the minimum standard for employees to pass this assessment.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Grade Type */}
                    <div>
                        <Select
                            label={<>Grading Scale <span className="text-red-500">*</span></>}
                            value={passingGradeType}
                            onChange={(v) => setPassingGradeType?.(v as "pass_fail" | "score_10" | "percentage")}
                            options={[
                                { label: "Pass / Fail", value: "pass_fail" },
                                { label: "Score (out of 10)", value: "score_10" },
                                { label: "Percentage (%)", value: "percentage" },
                            ]}
                        />
                    </div>

                    {/* Passing Score (conditional) */}
                    {passingGradeType !== "pass_fail" && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs sm:text-sm font-medium text-slate-700">
                                {getPassingScoreLabel()} <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="number"
                                min={0}
                                max={getPassingScoreMax()}
                                step={passingGradeType === "score_10" ? 0.5 : 1}
                                value={passingScore}
                                className="text-sm"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                        setPassingScore?.(Math.min(getPassingScoreMax(), Math.max(0, val)));
                                    }
                                }}
                            />
                            <p className="text-xs text-slate-500">
                                {passingGradeType === "score_10"
                                    ? `Employees need at least ${passingScore}/10 to pass.`
                                    : `Employees need at least ${passingScore}% to pass.`}
                            </p>
                        </div>
                    )}

                    {passingGradeType === "pass_fail" && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs sm:text-sm font-medium text-transparent select-none">Placeholder</label>
                            {passFailHint}
                        </div>
                    )}

                    {/* Max Attempts */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs sm:text-sm font-medium text-slate-700">
                            Max Attempts <span className="text-red-500">*</span>
                        </label>
                        <Input
                            type="number"
                            min={1}
                            max={10}
                            value={maxAttempts}
                            className="text-sm"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxAttempts?.(parseInt(e.target.value) || 1)}
                        />
                        <p className="text-xs text-slate-500">Maximum number of retake attempts allowed.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
