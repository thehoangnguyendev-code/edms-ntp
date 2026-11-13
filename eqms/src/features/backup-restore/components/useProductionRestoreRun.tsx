import React, { useCallback, useState } from "react";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { getApiErrorMessage } from "@/utils/apiError";
import { productionRestoreApi, waitForProductionJob, type BackupPart } from "@/services/api/backupRestore";
import { statusLabel } from "../types";
import { clearRestoreNotice, leaveRestoreNotice } from "../restoreSessionNotice";

const RESTORE_MEANING = { code: "BACKUP_RESTORE_EXECUTION", name: "Backup Restore Execution" };

/**
 * Everything after "Continue to Sign" in a restore: the electronic signature, the request to the agent and following the queued job to
 * its end. The Restore Backup list and the Backup Details page both use it, so a restore behaves the same wherever it is started.
 */
export function useProductionRestoreRun(onSettled: () => void) {
  const { showToast } = useToast();
  const [pending, setPending] = useState<{ backupNumber: string; parts: BackupPart[] }>();
  const [working, setWorking] = useState(0);

  /** Follows a queued job to its end and says plainly how it went; the caller is told either way. */
  const follow = useCallback(
    async (jobId: string, label: string) => {
      setWorking((n) => n + 1);
      try {
        const job = await waitForProductionJob(jobId);
        const result = job.result_json ? (JSON.parse(job.result_json) as { errorCode?: string; errorDetail?: string; detail?: string; failedStep?: string }) : {};
        if (job.status === "DONE") {
          showToast({ type: "success", title: label, message: "Done." });
        } else if (job.status === "FAILED") {
          const why = result.errorDetail || result.detail || (result.errorCode ? statusLabel(result.errorCode) : "The agent reported a failure.");
          showToast({ type: "error", title: `${label} did not complete`, message: `${result.failedStep ? `Stopped at ${result.failedStep}. ` : ""}${why}` });
        } else {
          showToast({ type: "info", title: label, message: "Still running. Refresh the list to see how it ended." });
        }
      } catch (e) {
        showToast({ type: "error", title: label, message: getApiErrorMessage(e, "Unable to follow the job.") });
      } finally {
        // still here and still signed in: nothing replaced the data (the job failed first), so no explanation is needed
        clearRestoreNotice();
        setWorking((n) => n - 1);
        onSettled();
      }
    },
    [showToast, onSettled],
  );

  const signed = async (data: { signatureToken?: string }) => {
    const action = pending;
    setPending(undefined);
    if (!action) return;
    if (!data.signatureToken) {
      showToast({ type: "error", title: "The signature could not be confirmed", message: "Try again." });
      return;
    }
    try {
      const { jobId } = await productionRestoreApi.restore(action.backupNumber, data.signatureToken, action.parts);
      const label = `Restore of ${action.backupNumber}`;
      // a restore of the database replaces the data the session lives in: leave the explanation for the sign-in page
      if (action.parts.includes("DATABASE")) leaveRestoreNotice("restored");
      showToast({ type: "info", title: label, message: "Accepted. It is running; this can take a while." });
      void follow(jobId, label);
    } catch (e) {
      showToast({ type: "error", title: "The request was refused", message: getApiErrorMessage(e, "Nothing was changed.") });
    }
  };

  const signatureModal: React.ReactNode = (
    <ESignatureModal
      isOpen={!!pending}
      onClose={() => setPending(undefined)}
      deferConfirm
      onConfirm={signed}
      actionTitle={pending ? `Restore ${pending.backupNumber}` : ""}
      meaningDisplayName={RESTORE_MEANING.name}
      meaningCode={RESTORE_MEANING.code}
    />
  );

  return { follow, working, begin: (backupNumber: string, parts: BackupPart[]) => setPending({ backupNumber, parts }), signatureModal };
}
