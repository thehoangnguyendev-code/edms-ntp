import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { reportError } from "@/services/api/reportTemplates";

/** Debounced server PDF; stale responses cannot replace the current draft. */
export function RealtimeReportPreview({
  requestKey,
  load,
  disabled = false,
}: {
  requestKey: string;
  load: (signal: AbortSignal) => Promise<Blob>;
  disabled?: boolean;
}) {
  const latest = useRef(load);
  latest.current = load;
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true,
      objectUrl = "";
    const controller = new AbortController();
    setUrl("");
    setError("");
    setBusy(!disabled);
    if (disabled) return;
    const timer = window.setTimeout(() => {
      Promise.resolve()
        .then(() => latest.current(controller.signal))
        .then((blob) => {
          if (!alive) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch((error) => {
          if (alive) setError(reportError(error));
        })
        .finally(() => {
          if (alive) setBusy(false);
        });
    }, 500);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requestKey, disabled, retry]);
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Live PDF preview
        </h3>
        <span role="status" className="text-xs text-slate-500">
          {busy ? "Updating from server…" : "Unsaved preview"}
        </span>
      </div>
      {error && (
        <div role="alert" className="mb-3 space-y-2 text-sm text-red-700">
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry preview
          </Button>
        </div>
      )}
      {url ? (
        <DocumentPdfViewer
          fileUrl={url}
          height="650px"
          minHeight="360px"
          forceHideDownloadAndPrint
        />
      ) : (
        <div className="flex h-[650px] min-h-[360px] items-center justify-center bg-white p-5 text-center text-sm text-slate-500">
          {disabled
            ? "Complete the required configuration to preview."
            : busy
              ? "Rendering PDF on the server…"
              : "No preview available."}
        </div>
      )}
    </div>
  );
}
