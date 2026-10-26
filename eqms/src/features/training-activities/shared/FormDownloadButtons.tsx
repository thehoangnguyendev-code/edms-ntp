import { useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingError, type TrainingFormFormat } from "@/services/api/trainingActivities";
import { saveBlob } from "./trainingLabels";

/**
 * The two buttons of a form of the company (Word and PDF): the file is written by the server in the Word template that Training Administration enabled, so what the screen offers is what the
 * procedure asks for. A refusal of the server (no template enabled, not approved yet) is shown as it is.
 */
export function FormDownloadButtons({ load, fileName, label }: { load: (format: TrainingFormFormat) => Promise<Blob>; fileName: (format: TrainingFormFormat) => string; label?: string }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<TrainingFormFormat | "">("");
  const download = async (format: TrainingFormFormat) => {
    setBusy(format);
    try {
      saveBlob(await load(format), fileName(format));
    } catch (e) {
      showToast({ type: "error", title: `${label ?? "The form"} was not exported`, message: trainingError(e) });
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      {(["docx", "pdf"] as const).map((format) => (
        <Button key={format} size="sm" variant="outline-emerald" className="whitespace-nowrap" loading={busy === format} disabled={!!busy} onClick={() => void download(format)}>
          {format === "docx" ? "Download Word" : "Download PDF"}
        </Button>
      ))}
    </>
  );
}
