import React, { useRef } from "react";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button/Button";

// Same "Choose File" button + hidden input + filename pattern used by UploadRevisionModal.tsx,
// reused here instead of a raw <input type="file"> so the UI stays visually consistent.
export const SectionFileField: React.FC<{
  file: File | null;
  onChange: (file: File | null) => void;
  onOversize: (message: string) => void;
  maxFileSizeMB: number;
  /** A controlled document template is kept as its Word file, so only DOCX is accepted. */
  docxOnly?: boolean;
}> = ({ file, onChange, onOversize, maxFileSizeMB, docxOnly = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={
          docxOnly
            ? ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : ".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
        }
        onChange={(e) => {
          const nextFile = e.target.files?.[0] ?? null;
          if (nextFile && docxOnly && !nextFile.name.toLowerCase().endsWith(".docx")) {
            onOversize("A controlled document template accepts only a DOCX (Word) file.");
            e.target.value = "";
            return;
          }
          if (
            nextFile &&
            nextFile.size > Math.max(maxFileSizeMB, 1) * 1024 * 1024
          ) {
            onOversize(
              `Selected file exceeds the maximum allowed size of ${maxFileSizeMB} MB.`,
            );
            e.target.value = "";
            return;
          }
          onChange(nextFile);
        }}
        className="hidden"
      />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 w-full">
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          size="sm"
          className="gap-2 w-full sm:w-auto flex-shrink-0 whitespace-nowrap"
        >
          <Upload className="h-4 w-4" />
          Choose File
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
          {file ? file.name : "No file chosen"}
        </span>
        {file && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            title="Delete uploaded file"
            aria-label="Delete uploaded file"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
