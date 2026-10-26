import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingError, trainingPaperApi } from "@/services/api/trainingActivities";
import { saveBlob } from "../../shared/trainingLabels";
import { displayDateTime } from "@/utils/format";

/**
 * The attendance list of the activity in the form APD.0117 (SOP.0003 5.3.4), filled in the Word template that Training Administration enabled. One button opens it in a window as the PDF is made
 * at that moment from what is recorded; Refresh makes it again after a change, and the window offers the Word file to edit and the PDF to print. The server decides whether the template
 * exists and whether the person may see it.
 */
export function AttendanceListExport({ activityId, trainingNumber }: { activityId: string; trainingNumber: string }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"load" | "docx" | "pdf" | "">("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [madeAt, setMadeAt] = useState("");
  const name = (ext: string) => `${trainingNumber.replace(/\//g, "-")}-APD.0117.${ext}`;

  const load = useCallback(async () => {
    setBusy("load");
    setError("");
    try {
      // the PDF of the window is a view: it carries the watermark of the preview settings; the file that is downloaded does not
      const blob = await trainingPaperApi.attendanceList(activityId, "pdf", true);
      setUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(blob);
      });
      setMadeAt(displayDateTime(new Date().toISOString()));
    } catch (e) {
      setError(trainingError(e));
    } finally {
      setBusy("");
    }
  }, [activityId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const download = async (format: "docx" | "pdf") => {
    setBusy(format);
    try {
      saveBlob(await trainingPaperApi.attendanceList(activityId, format), name(format));
    } catch (e) {
      showToast({ type: "error", title: "The attendance list was not exported", message: trainingError(e) });
    } finally {
      setBusy("");
    }
  };

  const close = () => {
    setOpen(false);
    setUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return "";
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline-emerald" onClick={() => setOpen(true)}>Training Attendance List</Button>
      </div>
      {open && (
        <FormModal
          isOpen
          onClose={close}
          onConfirm={() => void download("pdf")}
          title="Training Attendance List (APD.0117)"
          description={madeAt ? `${trainingNumber}. Made from what is recorded on ${madeAt}.` : trainingNumber}
          confirmText="Download PDF"
          cancelText="Close"
          isLoading={busy === "pdf"}
          confirmDisabled={!!busy || !url}
          footerExtra={(
            <>
              <Button size="sm" variant="outline" loading={busy === "load"} disabled={!!busy && busy !== "load"} onClick={() => void load()}>Refresh</Button>
              <Button size="sm" variant="outline" loading={busy === "docx"} disabled={!!busy} onClick={() => void download("docx")}>Download Word</Button>
            </>
          )}
          size="2xl"
          // no blur on the window: a blur makes the window the reference of the fixed menus of the viewer (the zoom menu would open far from its button)
          className="max-w-6xl backdrop-blur-none"
        >
          {error ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : busy === "load" && !url ? (
            <p className="py-12 text-center text-sm text-slate-500">Making the attendance list...</p>
          ) : url ? (
            <DocumentPdfViewer key={url} fileUrl={url} height="68dvh" minHeight="420px" forceHideDownloadAndPrint allowContextMenu={false} />
          ) : null}
        </FormModal>
      )}
    </>
  );
}
