import { tr } from "@/i18n";
import { useEffect, useState } from "react";
import { reportError, reportTemplatesApi, type ReportChart } from "@/services/api/reportTemplates";

/** How long the author stops changing the chart before the server is asked to draw it again. */
const DEBOUNCE_MS = 450;

/**
 * A sample of one analysis chart, as the PDF will show it: the server draws it with Chart.js from made-up groups and sends the picture, so the browser draws no chart and
 * the author sees exactly what a report will carry. It is drawn again, a moment after the author stops changing the type, the grouping, the metric or the number of groups.
 * The numbers are made up; it shows the shape of the chart, never the records of the report (REPORT-CHARTJS-2026-11-15).
 */
export function ReportChartPreview({ chart, fieldName, font }: { chart: ReportChart; fieldName: string; font?: string | null }) {
  const [picture, setPicture] = useState<string>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  // The picture depends on these and on nothing else.
  const key = JSON.stringify([chart.title, chart.type, chart.field, chart.metric, chart.maxGroups ?? null, fieldName, font ?? null]);

  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    setLoading(true);
    const timer = window.setTimeout(() => {
      reportTemplatesApi
        .chartPreview(chart, fieldName, font, controller.signal)
        .then((blob) => {
          url = URL.createObjectURL(blob);
          setPicture(url);
          setError("");
        })
        .catch((failure) => {
          if (controller.signal.aborted) return;
          setError(reportError(failure));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
    // `key` carries every input of the picture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" aria-label={`Sample of ${chart.title || "chart"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{chart.title || tr("Untitled chart")}</p>
        <span className="text-2xs font-medium uppercase tracking-wide text-slate-400">{tr("Sample data")}</span>
      </div>
      <div className="relative mt-3 aspect-[1400/850] w-full overflow-hidden rounded-lg bg-slate-50">
        {picture && <img src={picture} alt={`Sample of the chart ${chart.title || "Untitled chart"}`} className={`h-full w-full object-contain transition-opacity duration-200 ${loading ? "opacity-50" : "opacity-100"}`} />}
        {loading && (
          <div role="status" className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
            {picture ? "" : tr("Drawing the chart…")}
          </div>
        )}
        {error && !loading && (
          <p role="alert" className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
