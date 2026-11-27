import { useEffect, useState } from "react";
import { GitCompare, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { RadioGroup } from "@/components/ui/radio";
import { documentApi } from "@/services/api/documents";
import { formatDate } from "@/utils/format";
import { OnlyOfficeDocumentViewer } from "./OnlyOfficeDocumentViewer";
import { OnlyOfficeSideBySide } from "./OnlyOfficeSideBySide";
import { tr, trFormat } from "@/i18n";

type Baseline = Awaited<ReturnType<typeof documentApi.getRevisionComparisonBaselines>>[number];

type Mode = "side" | "marked";

/** Two documents next to each other need the width of a desktop screen. */
const SIDE_BY_SIDE_MIN_WIDTH = 1024;
const wideEnough = () => window.innerWidth >= SIDE_BY_SIDE_MIN_WIDTH;

const REVIEW_STAGES = new Set(["PENDING_REVIEW", "PENDING_APPROVAL"]);

const label = (baseline: Baseline) => {
  const name = trFormat(baseline.statusCode === "EFFECTIVE" ? "Effective revision {revision}" : "Obsoleted revision {revision}", { revision: baseline.revisionNumber });
  return baseline.effectiveDate ? `${name} (${formatDate(baseline.effectiveDate)})` : name;
};

/**
 * "Compare with Effective" for the full-screen editor of a Reviewer or Approver. The comparison is a separate read-only document laid over the editor: the file being
 * commented on is never changed, and the editing session stays open underneath, so "Close Compare" returns to it as it was. The chooser is drawn inside the frame
 * because the frame sits above the layer of the shared dialogs.
 */
export const useEditorComparison = (revisionId: string) => {
  const [baselines, setBaselines] = useState<Baseline[] | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [choice, setChoice] = useState("");
  const [comparing, setComparing] = useState<{ baseline: Baseline; mode: Mode } | null>(null);
  const [mode, setMode] = useState<Mode>("side");

  useEffect(() => {
    let cancelled = false;
    setBaselines(null);
    setComparing(null);
    setChoosing(false);
    const load = async () => {
      const revision = await documentApi.getRevisionById(revisionId);
      if (!REVIEW_STAGES.has(String(revision?.statusCode ?? ""))) return;
      const list = await documentApi.getRevisionComparisonBaselines(revisionId);
      if (!cancelled) setBaselines(list);
    };
    // The comparison is an aid: without the server's answer it is simply not offered.
    load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [revisionId]);

  const open = () => {
    setChoice(comparing?.baseline.revisionId ?? baselines?.[0]?.revisionId ?? "");
    setMode(wideEnough() ? comparing?.mode ?? "side" : "marked");
    setChoosing(true);
  };

  const start = () => {
    const chosen = baselines?.find((baseline) => baseline.revisionId === choice);
    if (chosen) setComparing({ baseline: chosen, mode });
    setChoosing(false);
  };

  const actions = baselines === null ? null : (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      {comparing && (
        <span className="hidden max-w-32 truncate rounded-md bg-slate-100 px-2 py-1 text-xs font-medium tabular-nums text-slate-600 sm:inline-block"
          role="status" aria-label={trFormat("Comparing with revision {revision}", { revision: comparing.baseline.revisionNumber })}
          title={trFormat("Comparing with revision {revision}", { revision: comparing.baseline.revisionNumber })}>
          {comparing.baseline.revisionNumber}
        </span>
      )}
      <Button type="button" size="sm" variant="outline-emerald" className="h-11 shrink-0 gap-2 whitespace-nowrap sm:h-9" disabled={baselines.length === 0} onClick={open}
        aria-label={tr("Compare with Effective")}
        title={baselines.length === 0 ? tr("This document has no effective revision to compare with.") : tr("Compare with Effective")}>
        <GitCompare className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden lg:inline">{tr("Compare with Effective")}</span>
        <span className="lg:hidden">{tr("Compare")}</span>
      </Button>
      {comparing && (
        <Button type="button" size="sm" variant="ghost" className="h-11 w-11 shrink-0 gap-2 whitespace-nowrap p-0 sm:h-9 sm:w-9 xl:w-auto xl:px-3" onClick={() => setComparing(null)}
          aria-label={tr("Close Compare")} title={tr("Close Compare")}>
          <Minimize2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden xl:inline">{tr("Close Compare")}</span>
        </Button>
      )}
    </div>
  );

  const view = comparing && (
    <div className="absolute inset-0 z-10 overflow-hidden bg-white">
      {comparing.mode === "side" ? (
        <OnlyOfficeSideBySide key={comparing.baseline.revisionId} revisionId={revisionId} baselineId={comparing.baseline.revisionId} />
      ) : (
        <div className="px-2 pt-1">
          <p className="px-2 pb-1 text-xs text-slate-600">{tr("The comparison uses the file as last saved. Added text is underlined and removed text is struck through.")}</p>
          <OnlyOfficeDocumentViewer
            key={comparing.baseline.revisionId}
            revisionId={`compare-${revisionId}-${comparing.baseline.revisionId}`}
            height="calc(100dvh - 6rem)"
            watchForChanges={false}
            loadConfig={() => documentApi.getRevisionComparisonConfig(revisionId, comparing.baseline.revisionId)}
          />
        </div>
      )}
    </div>
  );

  const chooser = choosing && baselines && (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
      <div role="dialog" aria-modal="true" aria-label={tr("Choose the revision to compare with")} className="w-full max-w-md rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-base font-semibold text-slate-900 md:px-5">{tr("Choose the revision to compare with")}</div>
        <div className="max-h-[50vh] space-y-4 overflow-y-auto p-4 md:p-5">
          <RadioGroup name="comparison-baseline" value={choice} onChange={(value) => setChoice(String(value))}
            options={baselines.map((baseline) => ({ value: baseline.revisionId, label: label(baseline) }))} />
          <div className="border-t border-slate-200 pt-3">
            <RadioGroup label="Comparison view" name="comparison-mode" value={mode} onChange={(value) => setMode(value === "marked" ? "marked" : "side")}
              options={[
                { value: "side", label: "Side by side", disabled: !wideEnough() },
                { value: "marked", label: "One document with changes marked" },
              ]} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:gap-3 md:px-5">
          <Button type="button" size="sm" variant="outline" onClick={() => setChoosing(false)}>{tr("Cancel")}</Button>
          <Button type="button" size="sm" disabled={!choice} onClick={start}>{tr("Compare")}</Button>
        </div>
      </div>
    </div>
  );

  return { actions, view, chooser };
};
