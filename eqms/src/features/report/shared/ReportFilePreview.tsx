import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { OnlyOfficeDocumentViewer } from "@/features/documents/shared/components/OnlyOfficeDocumentViewer";
import { reportTemplatesApi, reportError, type TemplateCriteria } from "@/services/api/reportTemplates";
import { tr } from "@/i18n";

/**
 * The CSV or XLSX file of the report, made as the report will be made and shown in the read-only OnlyOffice viewer (REPORT-OUTPUT-PREVIEW-2026-11-16). It is a working copy: the server
 * keeps it until the report is complete and then removes it, and nothing is written to the Audit Trail for it. It is made again after a pause when the criteria, the name or the format change.
 */
export function ReportFilePreview({
  code,
  criteria,
  title,
  format,
  full = false,
  disabled = false,
}: {
  code: string;
  criteria: TemplateCriteria;
  title: string;
  format: "CSV" | "XLSX";
  /** The report is run with the Full choice (no filter): the file is made under the ceiling of rows of a Full run. */
  full?: boolean;
  disabled?: boolean;
}) {
  const requestKey = JSON.stringify([code, criteria, title, format, full]);
  const [file, setFile] = useState<{ id: string; fileName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const latest = useRef({ code, criteria, title, format, full });
  latest.current = { code, criteria, title, format, full };

  useEffect(() => {
    let alive = true;
    setFile(null);
    setError("");
    if (disabled) return;
    setBusy(true);
    const timer = window.setTimeout(() => {
      const current = latest.current;
      reportTemplatesApi
        .previewFile(current.code, current.criteria, current.title, current.format, current.full)
        .then((made) => alive && setFile({ id: made.id, fileName: made.fileName }))
        .catch((failure) => alive && setError(reportError(failure)))
        .finally(() => alive && setBusy(false));
    }, 800);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [requestKey, disabled, retry]);

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{format} {tr("file preview")}</h3>
        <span role="status" className="text-xs text-slate-500">
          {busy ? "Making the file…" : file ? file.fileName : ""}
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        {tr("This is a temporary copy to look at before you generate the report. It is kept until the report is complete, then removed. It is not a report and is not recorded.")}
      </p>
      {busy && <SectionLoading text="Making the preview file..." />}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={() => setRetry((n) => n + 1)}>
              {tr("Try again")}
            </Button>
          </div>
        </div>
      )}
      {file && !busy && !error && (
        <OnlyOfficeDocumentViewer key={file.id} revisionId={file.id} watchForChanges={false} height="60dvh" loadConfig={() => reportTemplatesApi.previewFileViewConfig(file.id)} />
      )}
    </div>
  );
}
