import { trFormat as __ariaTrFormat } from "@/i18n";
import React, { useRef, useState } from "react";
import { FileUp, ScanLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { MAX_RECALL_FILE_BYTES, MAX_RECALL_SCANS, RECALL_SCAN_ACCEPT } from "@/services/api/controlledCopyRecallBatches";
import { RecallScanPanel, type RecallQueuedFile, type RecallScanProgress } from "./RecallScanPanel";
import { formatBytes } from "./recallFormat";
import { tr, trFormat } from "@/i18n";

/**
 * Where scans are chosen and sent: the drop area, the list of chosen files and the buttons. While the codes are read, the card gives up a third of the width to the left and
 * the scan panel (a sheet of paper and a sweeping line) takes its place. It is the same in the page (a new draft) and in the Add More Scans dialog (a draft already open).
 */
export const RecallUploadArea: React.FC<{
  selected: File[];
  /** How many files may still be chosen (the batch holds at most 50 scans in all). */
  maxFiles: number;
  busy: boolean;
  progress: RecallScanProgress | null;
  queue: RecallQueuedFile[];
  onSelect: (files: FileList | File[] | null) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onUpload: () => void;
  onStop: () => void;
  inputTestId?: string;
  /** In a dialog the title is the dialog's own, and the card has no frame of its own. */
  inDialog?: boolean;
}> = ({ selected, maxFiles, busy, progress, queue, onSelect, onRemove, onClear, onUpload, onStop, inputTestId = "recall-scan-input", inDialog = false }) => {
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectedBytes = selected.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className={cn("grid grid-cols-1 gap-4 transition-[grid-template-columns,gap] duration-500 ease-out", progress ? "lg:grid-cols-[2fr_1fr]" : "lg:grid-cols-[1fr_0fr] lg:gap-0")}>
      <div
        className={cn(
          "min-w-0 transition-opacity duration-500",
          inDialog ? "" : "rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5",
          progress && "opacity-80",
        )}
      >
        {!inDialog && (
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ScanLine className="h-4 w-4 text-emerald-600" /> {tr("Upload scans of returned paper copies")}
          </h2>
        )}
        <p className={cn("text-xs text-slate-500", !inDialog && "mt-1")}>
          {trFormat("Choose up to {max} scans (PDF only, {size} each), one file per paper copy. Each file is checked for viruses, its QR code is read and matched to a controlled copy. Nothing is recalled until you have reviewed the list and signed.", { max: maxFiles, size: formatBytes(MAX_RECALL_FILE_BYTES) })}
        </p>

        <div
          onClick={() => !busy && fileInput.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!busy) onSelect(event.dataTransfer.files);
          }}
          className={cn(
            "mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragging ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-slate-50 hover:border-emerald-300",
          )}
        >
          <FileUp className="h-6 w-6 text-slate-400" />
          <p className="text-sm text-slate-600">{tr("Drop the scans here, or")}</p>
          <Button
            size="sm"
            variant="outline-emerald"
            disabled={busy || selected.length >= maxFiles}
            onClick={(event) => {
              event.stopPropagation();
              fileInput.current?.click();
            }}
          >
            {tr("Choose Files")}
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={RECALL_SCAN_ACCEPT}
            className="hidden"
            data-testid={inputTestId}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              onSelect(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        {selected.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-700">
                {trFormat("{selected} of {max} files chosen · {size}", { selected: selected.length, max: maxFiles, size: formatBytes(selectedBytes) })}
            </p>
            <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200">
              {selected.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                  <span className="truncate text-slate-800">{file.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-slate-500">
                    {formatBytes(file.size)}
                    <button type="button" aria-label={__ariaTrFormat("Remove {v1}", { v1: file.name })} className="text-slate-400 hover:text-red-600 disabled:opacity-40" disabled={busy} onClick={() => onRemove(index)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={onClear}>
                {tr("Clear")}
              </Button>
              <Button size="sm" variant="outline-emerald" disabled={busy} onClick={onUpload}>
                {tr("Read Codes and Review")}
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="min-w-0 overflow-hidden">{progress && <RecallScanPanel progress={progress} queue={queue} onStop={onStop} />}</div>
    </div>
  );
};
