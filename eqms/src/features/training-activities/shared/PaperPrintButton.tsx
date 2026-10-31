import { useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingError, type TrainingFormFormat } from "@/services/api/trainingActivities";
import { Textarea } from "./TrainingFields";
import { saveBlob } from "./trainingLabels";

/** One numbered paper print: what is asked from the server and the name of the file that is saved. */
export type PaperPrintItem = { key: string; load: (format: TrainingFormFormat, reason?: string) => Promise<Blob>; fileName: (format: TrainingFormFormat) => string };

const reasonRequired = (e: unknown) => {
  const code = (e as { response?: { data?: { error?: { code?: string; message?: string } } } }).response?.data?.error;
  return code?.code === "TRAINING_REASON_REQUIRED" || String(code?.message ?? "").includes("TRAINING_REASON_REQUIRED");
};

/**
 * The paper print of a form that is signed by hand: the server numbers the copy and records it. The first print needs no reason; when the server says that a reason is needed (a reprint), the
 * person is asked for it once and only the prints that need it are made again with it. With several items (one for each department) every print is saved as its own file, never in a ZIP.
 */
export function PaperPrintButton({ items, label = "Print for Signing" }: { items: PaperPrintItem[]; label?: string }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState<PaperPrintItem[]>([]);
  const [reason, setReason] = useState("");
  const asking = waiting.length > 0;

  const print = async (list: PaperPrintItem[], why?: string) => {
    setBusy(true);
    const needReason: PaperPrintItem[] = [];
    const failed: string[] = [];
    for (const item of list) {
      try {
        saveBlob(await item.load("pdf", why), item.fileName("pdf"));
      } catch (e) {
        if (!why && reasonRequired(e)) needReason.push(item);
        else failed.push(trainingError(e));
      }
    }
    setWaiting(needReason);
    if (needReason.length === 0) setReason("");
    if (failed.length > 0) showToast({ type: "error", title: "The paper print was not made", message: failed[0] });
    setBusy(false);
  };

  return (
    <>
      <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" loading={busy && !asking} disabled={busy} onClick={() => void print(items)}>{label}</Button>
      {asking && (
        <FormModal
          isOpen
          onClose={() => { setWaiting([]); setReason(""); }}
          onConfirm={() => void print(waiting, reason.trim())}
          title="Print another copy"
          description={waiting.length > 1 ? `Another numbered copy is recorded for each of the ${waiting.length} lists. Say why it is needed.` : "Another numbered copy is recorded. Say why it is needed."}
          confirmText="Print"
          isLoading={busy}
          confirmDisabled={!reason.trim()}
          size="md"
        >
          <FormField label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
        </FormModal>
      )}
    </>
  );
}
