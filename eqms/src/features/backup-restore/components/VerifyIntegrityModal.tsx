import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, Minus, X } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Progress } from "@/components/ui/progress";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { backupRestoreApi, type IntegrityCheckResult } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { statusLabel } from "../types";
import { tr, trFormat } from "@/i18n";

type Phase = "starting" | "running" | "done" | "error";
type RowState = "pending" | "running" | "passed" | "failed" | "skipped";

const POLL_MS = 700;
const GIVE_UP_MS = 10 * 60 * 1000;
/** A finished check is shown at least this long after the one before it, so a quick check is still seen being ticked off. */
const REVEAL_MS = 320;

/** The checks in the order the agent runs them, with names for what each one checks. They are shown only; nothing here decides anything. */
const PLAN: { code: string; label: string }[] = [
  { code: "RUN_COMPLETED", get label() { return tr("The backup finished"); } },
  { code: "SET_PRESENT", get label() { return tr("The backup folder is present"); } },
  { code: "MANIFEST_UNCHANGED", get label() { return tr("The manifest is unchanged"); } },
  { code: "MANIFEST_SIGNATURE", get label() { return tr("The manifest signature is valid"); } },
  { code: "FILES_MATCH_MANIFEST", get label() { return tr("The files match the manifest"); } },
  { code: "OBJECTS_PRESENT", get label() { return tr("Stored documents are present"); } },
  { code: "CHECKSUM_FILE", get label() { return tr("The checksum file agrees"); } },
  { code: "CHAIN_TO_PREVIOUS", get label() { return tr("It follows the previous backup"); } },
  { code: "ENCRYPTED_FOR_KEY", get label() { return tr("It is encrypted for the expected key"); } },
  { code: "LEDGER_RECORDS_MANIFEST", get label() { return tr("The ledger recorded this backup"); } },
];
const EXTRA_LABEL: Record<string, string> = {
  SET_RECORDED: "Location and manifest are recorded",
  MANIFEST_READABLE: "The manifest can be read",
};
const labelOf = (code: string) => PLAN.find((p) => p.code === code)?.label ?? EXTRA_LABEL[code] ?? statusLabel(code);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseChecks = (text: string | null | undefined): IntegrityCheckResult[] => {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as IntegrityCheckResult[]) : [];
  } catch {
    return [];
  }
};

/** The mark of a row: a spinner while it is being checked, a tick that draws itself when it passed, a cross when it failed. */
const Mark: React.FC<{ state: RowState; reduce: boolean }> = ({ state, reduce }) => {
  if (state === "running") return <Loader2 className="h-5 w-5 animate-spin text-emerald-600" aria-label={tr("Checking")} />;
  if (state === "passed" || state === "failed") {
    const passed = state === "passed";
    return (
      <motion.span
        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
        className={`flex h-5 w-5 items-center justify-center rounded-full ${passed ? "bg-emerald-600" : "bg-red-600"}`}
        aria-label={passed ? "Passed" : "Failed"}
      >
        {passed ? (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.28, delay: 0.08, ease: "easeOut" }} />
          </svg>
        ) : (
          <X className="h-3.5 w-3.5 text-white" strokeWidth={3.5} />
        )}
      </motion.span>
    );
  }
  if (state === "skipped") return <Minus className="h-5 w-5 text-slate-300" aria-label={tr("Not needed for this backup")} />;
  return <span className="block h-5 w-5 rounded-full border-2 border-slate-200" aria-label={tr("Waiting")} />;
};

/**
 * Runs an integrity check on one backup and shows it as it goes. The progress is the number the Backup Agent reports while it reads the
 * files and works through the checks; this screen only displays it. Each check appears in the list when the agent has finished it (a
 * quick one is held for a moment so it can be seen). Closing the window does not stop the check: the agent finishes and records it either way.
 */
export const VerifyIntegrityModal: React.FC<{ isOpen: boolean; backupNumber: string; onClose: () => void; onFinished: () => void }> = ({ isOpen, backupNumber, onClose, onFinished }) => {
  const reduce = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>("starting");
  const [progress, setProgress] = useState(0);
  const [verification, setVerification] = useState("");
  const [arrived, setArrived] = useState<IntegrityCheckResult[]>([]);
  const [shown, setShown] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    setPhase("starting");
    setProgress(0);
    setVerification("");
    setArrived([]);
    setShown(0);
    setMessage("");
    (async () => {
      try {
        const { jobId } = await backupRestoreApi.verify(backupNumber);
        if (!live) return;
        setPhase("running");
        const started = Date.now();
        for (;;) {
          const job = await backupRestoreApi.job(jobId);
          if (!live) return;
          setProgress(Math.max(0, Math.min(100, job.progress ?? 0)));
          if (job.status === "DONE" || job.status === "FAILED") {
            const result = job.result_json ? (JSON.parse(job.result_json) as { verification?: string; checks?: IntegrityCheckResult[]; errorCode?: string }) : {};
            setProgress(100);
            setVerification(result.verification ?? "");
            setArrived(result.checks ?? parseChecks(job.steps_json));
            if (!result.verification) setMessage(result.errorCode ? statusLabel(result.errorCode) : tr("The agent reported a failure."));
            setPhase(result.verification ? "done" : "error");
            onFinished();
            return;
          }
          setArrived(parseChecks(job.steps_json));
          if (Date.now() - started > GIVE_UP_MS) {
            setMessage("The check is still running. Its result will appear in the Verification History when it ends.");
            setPhase("error");
            return;
          }
          await wait(POLL_MS);
        }
      } catch (e) {
        if (!live) return;
        setMessage(getApiErrorMessage(e, "The check could not be started."));
        setPhase("error");
      }
    })();
    return () => {
      live = false;
    };
    // The check starts when the window opens for a backup; the refresh callback is not a reason to start another one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, backupNumber]);

  // Reveal the finished checks one at a time.
  useEffect(() => {
    if (shown >= arrived.length) return;
    const timer = setTimeout(() => setShown((n) => Math.min(n + 1, arrived.length)), reduce ? 0 : REVEAL_MS);
    return () => clearTimeout(timer);
  }, [shown, arrived.length, reduce]);

  const caughtUp = shown >= arrived.length;
  const ended = (phase === "done" || phase === "error") && caughtUp;
  const passed = verification === "VERIFIED";
  const running = !ended;

  const revealed = new Map(arrived.slice(0, shown).map((c) => [c.code, c]));
  const codes = [...PLAN.map((p) => p.code), ...arrived.map((c) => c.code).filter((code) => !PLAN.some((p) => p.code === code))];
  const firstOpen = codes.findIndex((code) => !revealed.has(code));
  const rows = codes.map((code, index) => {
    const got = revealed.get(code);
    let state: RowState;
    if (got) state = got.ok ? "passed" : "failed";
    else if (ended) state = "skipped";
    else state = index === firstOpen && phase !== "starting" ? "running" : "pending";
    return { code, label: labelOf(code), state, detail: got?.detail };
  });

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onClose}
      title={tr("Verify Integrity")}
      description={trFormat("Checks that {batch} is complete, unchanged and signed. The data is not decrypted and nothing is changed.", { batch: backupNumber })}
      confirmText="Close"
      showCancel={false}
      size="xl"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-700 sm:text-sm">
            <span>{running ? "Checking…" : phase === "done" ? (passed ? tr("Check passed") : tr("Check failed")) : tr("Check not completed")}</span>
            <span aria-live="polite">{progress}%</span>
          </div>
          <Progress value={progress} size="lg" variant={running ? "emerald" : phase === "done" && passed ? "success" : "error"} />
          {running && <p className="text-xs text-slate-500">{tr("You can close this window; the check carries on and is recorded either way.")}</p>}
        </div>

        {phase !== "error" || arrived.length > 0 ? (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200" aria-label={tr("Checks")}>
            {rows.map((row) => (
              <li key={row.code} data-check={row.code} data-state={row.state} className={`flex items-start gap-3 px-3 py-2 ${row.state === "pending" || row.state === "skipped" ? "text-slate-400" : "text-slate-800"}`}>
                <span className="mt-0.5 shrink-0">
                  <Mark state={row.state} reduce={reduce} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${row.state === "running" ? "font-medium" : ""}`}>{row.label}</span>
                  <AnimatePresence initial={false}>
                    {row.detail ? (
                      <motion.span
                        initial={reduce ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className={`block overflow-hidden whitespace-normal break-words text-xs ${row.state === "failed" ? "text-red-600" : "text-slate-500"}`}
                      >
                        {row.detail}
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </span>
                {row.state === "skipped" && <span className="shrink-0 text-xs text-slate-400">{tr("Not needed")}</span>}
              </li>
            ))}
          </ul>
        ) : null}

        {phase === "error" && caughtUp && <WarningBanner variant="error" title={tr("The check did not finish")} description={message} />}

        {phase === "done" && caughtUp && (
          <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <WarningBanner
              variant={passed ? "success" : "error"}
              title={passed ? tr("This backup passed its integrity check") : tr("This backup did not pass its integrity check")}
              description={passed ? tr("It can be used for a restore request.") : tr("It cannot be used for a restore. See the checks above for what failed.")}
            />
          </motion.div>
        )}
      </div>
    </FormModal>
  );
};
