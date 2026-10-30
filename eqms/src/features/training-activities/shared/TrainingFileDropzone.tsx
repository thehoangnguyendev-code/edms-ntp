import { useRef, useState, type ReactNode } from "react";
import { Download, Eye, Trash2, Upload } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { Progress } from "@/components/ui/progress";
import { getFileIconSrc } from "@/utils/fileIcons";

const formatSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`);

interface Props {
  label: string;
  description?: string;
  /** Extensions accepted, for example ".pdf,.docx". */
  accept: string;
  /** Text under the drop zone, for example "PDF, Word or Office file (max 20 MB)". */
  hint: string;
  maxMb: number;
  file: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
  /** A tag next to the label, for example who may see the file. */
  badge?: ReactNode;
  /** A file that is already on record: shown as the card, with Preview, Download and (when allowed) Remove. The drop zone is not shown. */
  existing?: { name: string; size: number; onDownload: () => void; onPreview?: () => void; onRemove?: () => void; note?: string };
  /** Shown instead of the drop zone when nothing can be added any more. */
  readOnlyText?: string;
  disabled?: boolean;
  /** While the file is being sent: the share sent so far (0 to 100). The card shows the progress bar. */
  uploading?: { percent: number };
}

/** Drop zone with the file card of the old test and answer-key upload: click or drag, then the file shows with its type icon, size, the progress of the upload and a remove button. */
export function TrainingFileDropzone({ label, description, accept, hint, maxMb, file, onChange, required, badge, existing, readOnlyText, disabled, uploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const extensions = accept.split(",").map((x) => x.trim().toLowerCase());

  const pick = (next?: File) => {
    if (!next) return;
    const ext = `.${next.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!extensions.includes(ext)) { setError(`"${next.name}" is not a supported file type.`); return; }
    if (next.size > maxMb * 1048576) { setError(`"${next.name}" is larger than ${maxMb} MB.`); return; }
    setError("");
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-slate-700 sm:text-sm">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</label>
        {badge}
      </div>
      {description && <p className="text-xs text-slate-500">{description}</p>}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      {existing ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
              <img src={getFileIconSrc(existing.name)} alt="file icon" className="h-6 w-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{existing.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{formatSize(existing.size)}{existing.note ? ` · ${existing.note}` : ""}</p>
            </div>
            {existing.onPreview && <button type="button" onClick={existing.onPreview} className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-slate-200" title="Preview" aria-label="Preview"><Eye className="h-4 w-4 text-slate-500 hover:text-emerald-600" /></button>}
            <button type="button" onClick={existing.onDownload} className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-slate-200" title="Download" aria-label="Download"><Download className="h-4 w-4 text-slate-500 hover:text-emerald-600" /></button>
            {existing.onRemove && <button type="button" onClick={existing.onRemove} className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-slate-200" title="Remove file" aria-label="Remove file"><Trash2 className="h-4 w-4 text-slate-500 hover:text-red-600" /></button>}
          </div>
        </div>
      ) : readOnlyText ? (
        <div className="flex min-h-[140px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-400">{readOnlyText}</div>
      ) : file ? (
        <div className="group rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-colors hover:bg-slate-100/50 md:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
              <img src={getFileIconSrc(file.name)} alt="file icon" className="h-6 w-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatSize(file.size)}
                {uploading && <span className="ml-2 font-medium text-emerald-600">{uploading.percent >= 100 ? "Checking the file…" : `${uploading.percent}% uploaded`}</span>}
              </p>
              {uploading && (
                <div className="mt-2">
                  <Progress value={uploading.percent} size="xs" variant="success" animated />
                </div>
              )}
            </div>
            {!uploading && (
              <button type="button" onClick={() => onChange(null)} className="flex-shrink-0 rounded-lg p-1 opacity-0 transition-colors hover:bg-slate-200 group-hover:opacity-100 focus:opacity-100" title="Remove file" aria-label="Remove file">
                <Trash2 className="h-4 w-4 text-slate-500 hover:text-red-600" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled) pick(e.dataTransfer.files[0]); }}
          onClick={() => !disabled && inputRef.current?.click()}
          className={cn(
            "relative flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 transition-all duration-200 md:p-5",
            dragging ? "border-emerald-500 bg-emerald-50/50" : "border-slate-300 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/30",
          )}
        >
          <div className={cn("mb-3 flex h-12 w-12 items-center justify-center rounded-full transition-colors", dragging ? "bg-emerald-100" : "bg-slate-100")}>
            <Upload className={cn("h-6 w-6", dragging ? "text-emerald-600" : "text-slate-400")} />
          </div>
          <p className="text-center text-xs font-medium text-slate-700 sm:text-sm">{dragging ? "Drop your file here" : "Click to upload or drag & drop"}</p>
          <p className="mt-1 text-2xs font-normal text-slate-400 sm:text-xs">{hint}</p>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
