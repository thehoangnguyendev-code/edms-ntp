import { useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingError, type TrainingFormFormat } from "@/services/api/trainingActivities";
import { Textarea } from "./TrainingFields";
import { saveBlob } from "./trainingLabels";

/**
 * The paper print of a form that is signed by hand: the server numbers the copy and records it. The first print needs no reason; when the server says that a reason is needed (a reprint), the
 * person is asked for it and the print is made again with it.
 */
export function PaperPrintButton({ load, fileName, label = "Print for Signing" }: { load: (format: TrainingFormFormat, reason?: string) => Promise<Blob>; fileName: (format: TrainingFormFormat) => string; label?: string }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");

  const print = async (why?: string) => {
    setBusy(true);
    try {
      saveBlob(await load("pdf", why), fileName("pdf"));
      setAsking(false);
      setReason("");
    } catch (e) {
      const code = (e as { response?: { data?: { error?: { code?: string; message?: string } } } }).response?.data?.error;
      if (!why && (code?.code === "TRAINING_REASON_REQUIRED" || String(code?.message ?? "").includes("TRAINING_REASON_REQUIRED"))) setAsking(true);
      else showToast({ type: "error", title: "The paper print was not made", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" loading={busy && !asking} disabled={busy} onClick={() => void print()}>{label}</Button>
      {asking && (
        <FormModal
          isOpen
          onClose={() => { setAsking(false); setReason(""); }}
          onConfirm={() => void print(reason.trim())}
          title="Print another copy"
          description="Another numbered copy is recorded. Say why it is needed."
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
