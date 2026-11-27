import { useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingError, trainingFilesApi, type TrainingScanBatchResult } from "@/services/api/trainingActivities";
import { TrainingFileDropzone } from "../../shared/TrainingFileDropzone";
import { tr, trFormat } from "@/i18n";

const STATE: Record<string, { label: string; color: "emerald" | "amber" | "slate" }> = {
  STORED: { label: "Stored", color: "emerald" },
  STORED_INCOMPLETE: { get label() { return tr("Stored, pages missing"); }, color: "amber" },
  ALREADY_UPLOADED: { get label() { return tr("Already uploaded"); }, color: "slate" },
};

/**
 * One scanned PDF with the pages of many people, in any order. Every printed page carries a QR code that says its copy, its person and its page, so nothing is chosen here: the server sorts the pages,
 * stores one file for each person and closes each copy as Returned. A page whose code cannot be read is never guessed; it is listed so that it is scanned again.
 */
export function TrainingScanBatchUpload({ activityId, onDone }: { activityId: string; onDone: () => void }) {
  const { showToast } = useToast();
  const [sending, setSending] = useState<{ file: File; percent: number }>();
  const [result, setResult] = useState<TrainingScanBatchResult>();

  const send = async (file: File) => {
    setSending({ file, percent: 0 });
    setResult(undefined);
    try {
      const answer = await trainingFilesApi.uploadScanBatch(activityId, file, (percent) => setSending({ file, percent }));
      setResult(answer);
      showToast({ type: answer.unrecognisedPages.length > 0 ? "warning" : "success", title: trFormat("{count} file(s) stored", { count: answer.stored }), message: answer.unrecognisedPages.length > 0 ? trFormat("{count} page(s) not recognised", { count: answer.unrecognisedPages.length }) : "" });
      onDone();
    } catch (e) {
      showToast({ type: "error", title: tr("The scans were not uploaded"), message: trainingError(e) });
    } finally {
      setSending(undefined);
    }
  };

  return (
    <div className="space-y-3">
      <TrainingFileDropzone
        label={tr("Scanned pages")}
        accept=".pdf"
        maxMb={100}
        hint={tr("One PDF with all the scanned pages, in any order. The QR code on each printed page tells the system whose it is.")}
        file={sending?.file ?? null}
        uploading={sending ? { percent: sending.percent } : undefined}
        disabled={!!sending}
        onChange={(file) => { if (file) void send(file); }}
      />
      <p className="text-xs text-slate-500">{tr("A second person checks each scan against the paper.")}</p>
      {result && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm" role="status">
          <p className="font-medium text-slate-800">{trFormat("{read} page(s) read: {stored} file(s) stored.", { read: result.totalPages, stored: result.stored })}</p>
          {result.files.length > 0 && (
            <ul className="space-y-1">
              {result.files.map((f) => (
                <li key={`${f.packCode}-${f.person ?? ""}`} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{f.packCode}</span>
                  {f.person && <span>{f.person}</span>}
                  <span className="text-slate-500">{trFormat("{found} of {expected} pages", { found: f.pagesFound, expected: f.pagesExpected })}{f.duplicatePages > 0 ? trFormat(", {count} repeated", { count: f.duplicatePages }) : ""}</span>
                  <Badge color={STATE[f.state]?.color ?? "slate"}>{STATE[f.state]?.label ?? f.state}</Badge>
                </li>
              ))}
            </ul>
          )}
          {result.unrecognisedPages.length > 0 && (
            <p className="text-amber-700">
              {trFormat("{count} page(s) have no readable code or belong to no copy of this training (page {pages}). They were not stored: scan them again.", { count: result.unrecognisedPages.length, pages: result.unrecognisedPages.join(", ") })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
