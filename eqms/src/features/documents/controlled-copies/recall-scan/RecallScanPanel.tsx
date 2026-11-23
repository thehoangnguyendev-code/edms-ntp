import React, { useRef } from "react";
import { Check, Circle, Loader2, QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";
import { formatBytes } from "./recallFormat";
import { tr, trFormat } from "@/i18n";

export type RecallQueueState = "waiting" | "active" | "done" | "failed";
export interface RecallQueuedFile {
  name: string;
  size: number;
  state: RecallQueueState;
}

/** What the upload reports for the file in hand; every number comes from the real work (bytes sent, steps the server reports), nothing is timed. */
export interface RecallScanProgress {
  index: number;
  count: number;
  fileName: string;
  /** The whole set, weighted by file size. */
  percent: number;
  /** This file only: the line sweeps the sheet from top to bottom as this goes from 0 to 100. */
  filePercent: number;
  /** The whole file has been sent; the server is working on it. */
  processing: boolean;
  /** What the server is doing now (from the server, not guessed). */
  step?: string;
  /** Every file is in and its code is read: the sheet shows a check before the screen moves on. */
  finished?: boolean;
}

const LINE_WIDTHS = ["w-full", "w-11/12", "w-full", "w-4/5", "w-full", "w-10/12", "w-3/5"];

/**
 * A sheet of paper with the scan line on it. Its key is the file, so a new file brings a new sheet and the line starts again at the top.
 * GSAP does the moving: the sheet comes in, the line and the area it has passed glide to where the real work stands (`data-scan-percent` is that real value,
 * the animation only smooths the way there), the line breathes while it waits, and the check pops when everything is read. With "reduce motion" it all jumps.
 */
const Sheet: React.FC<{ percent: number; done: boolean }> = ({ percent, done }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const passedRef = useRef<HTMLDivElement>(null);

  // the sheet slides in, once per file
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.from(sheetRef.current, { opacity: 0, y: 14, scale: 0.97, duration: 0.4, ease: "power2.out", clearProps: "opacity,transform" });
  }, { scope: sheetRef, dependencies: [] });

  // the line and the passed area follow the real progress; a position that was never set is set at once, the next ones are glided to
  useGSAP(() => {
    const move = (element: HTMLElement | null, property: "top" | "height") => {
      if (!element) return;
      const value = { [property]: `${percent}%` };
      if (!element.style[property] || prefersReducedMotion()) gsap.set(element, value);
      else gsap.to(element, { ...value, duration: 0.6, ease: "power1.out", overwrite: "auto" });
    };
    move(lineRef.current, "top");
    move(passedRef.current, "height");
  }, { scope: sheetRef, dependencies: [percent, done] });

  // the line breathes while it works
  useGSAP(() => {
    if (done || prefersReducedMotion()) return;
    const beam = sheetRef.current?.querySelector('[data-recall-part="line"]');
    if (beam) gsap.to(beam, { opacity: 0.65, duration: 0.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
  }, { scope: sheetRef, dependencies: [done] });

  // the check pops
  useGSAP(() => {
    if (!done || prefersReducedMotion()) return;
    gsap.from('[data-recall-part="check"]', { opacity: 0, scale: 0.4, duration: 0.5, ease: "back.out(2.2)", clearProps: "opacity,transform" });
  }, { scope: sheetRef, dependencies: [done] });

  return (
    <div ref={sheetRef} data-recall-part="sheet" className="relative mx-auto h-56 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md sm:h-60 sm:w-48" aria-hidden="true">
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="mt-1 flex-1 space-y-1.5">
            <div className="h-2 w-4/5 rounded bg-slate-300" />
            <div className="h-1.5 w-1/2 rounded bg-slate-200" />
          </div>
          <QrCode className="h-9 w-9 shrink-0 text-slate-500" strokeWidth={1.5} />
        </div>
        <div className="space-y-1.5 pt-2">
          {LINE_WIDTHS.map((width, position) => (
            <div key={position} className={cn("h-1.5 rounded bg-slate-100", width)} />
          ))}
        </div>
        <div className="space-y-1.5 pt-2">
          <div className="h-1.5 w-full rounded bg-slate-100" />
          <div className="h-1.5 w-2/3 rounded bg-slate-100" />
        </div>
        <div className="absolute bottom-4 right-4 h-px w-16 bg-slate-300" />
      </div>

      {/* what the line has passed */}
      <div ref={passedRef} data-recall-part="passed" data-scan-percent={percent} className="absolute inset-x-0 top-0 bg-emerald-500/10" />
      {/* the line itself, with a glow behind it */}
      {!done && (
        <div ref={lineRef} data-recall-part="line-holder" data-scan-percent={percent} className="absolute inset-x-0">
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-emerald-400/30 to-transparent" />
          <div data-recall-part="line" className="h-0.5 w-full bg-emerald-500 shadow-lg shadow-emerald-500/70" />
        </div>
      )}
      {done && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <span data-recall-part="check" className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40">
            <Check className="h-8 w-8" strokeWidth={3} />
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * The scan panel of Recall by Scan: a sheet of paper and a line that sweeps it while the file is read. The line stands where the real work stands (bytes sent first, then the
 * steps the server reports for this file), so a slow file is a slow sweep. It replaces the progress bar. The screen goes on only when the last file has been read.
 */
export const RecallScanPanel: React.FC<{
  progress: RecallScanProgress;
  queue: RecallQueuedFile[];
  onStop: () => void;
  className?: string;
}> = ({ progress, queue, onStop, className }) => {
  const done = Boolean(progress.finished);
  const panelRef = useRef<HTMLElement>(null);
  // the panel comes in beside the upload card
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.from(panelRef.current, { opacity: 0, x: 16, duration: 0.5, ease: "power2.out", clearProps: "opacity,transform" });
  }, { scope: panelRef, dependencies: [] });
  return (
    <section ref={panelRef} data-recall-part="panel" className={cn("rounded-xl border border-emerald-200 bg-white p-4 shadow-sm md:p-5", className)} role="status" aria-label={tr("Reading the scans")}>
      <div className="sr-only" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-label={tr("Upload progress")} />
      <Sheet key={progress.index} percent={done ? 100 : progress.filePercent} done={done} />

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-emerald-800">
        <span className="flex min-w-0 items-center gap-2">
          {!done && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
          <span className="truncate">
                  {trFormat("File {index} of {count} · {name}", { index: progress.index, count: progress.count, name: progress.fileName })}
          </span>
        </span>
        <span className="shrink-0 font-semibold tabular-nums">{progress.percent}%</span>
      </div>
      <p className="mt-1 text-2xs text-emerald-700">
        {done ? "All codes are read." : progress.processing ? progress.step ?? "Reading the code..." : "Sending the file. Keep this page open."}
      </p>

      {queue.length > 1 && (
        <ul className="mt-3 max-h-40 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200 bg-white" aria-label={tr("Files in this upload")}>
          {queue.map((file, position) => (
            <li key={`${file.name}-${position}`} className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700">
              {file.state === "done" ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label={tr("Uploaded")} />
              ) : file.state === "active" ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-600" aria-label={tr("Uploading")} />
              ) : file.state === "failed" ? (
                <X className="h-3.5 w-3.5 shrink-0 text-red-600" aria-label={tr("Failed")} />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-label={tr("Waiting")} />
              )}
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-slate-400">{formatBytes(file.size)}</span>
            </li>
          ))}
        </ul>
      )}

      {queue.length > 1 && progress.percent < 100 && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={onStop}>
            {tr("Stop After This File")}
          </Button>
        </div>
      )}
    </section>
  );
};
