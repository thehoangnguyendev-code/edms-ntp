import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/toast/Toast";
import { waitForBackupJob } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { statusLabel } from "../types";

/**
 * Follows a job the Backup Agent has queued (a backup, an integrity check) to its end and tells the person how it went. The
 * work carries on in the agent even if the person leaves the screen; this only reports it and asks the screen to refresh.
 */
export const useBackupJobs = (onFinished: () => void) => {
  const { showToast } = useToast();
  const [working, setWorking] = useState(0);

  const follow = useCallback(
    async (jobId: string, label: string) => {
      setWorking((n) => n + 1);
      try {
        const job = await waitForBackupJob(jobId);
        const result = job.result_json ? (JSON.parse(job.result_json) as { backupNumber?: string; errorCode?: string; verification?: string }) : {};
        if (job.status === "DONE") {
          showToast({ type: "success", title: label, message: `${result.backupNumber ?? "Done"}${result.verification ? `: integrity ${statusLabel(result.verification).toLowerCase()}` : ""}` });
        } else if (job.status === "FAILED") {
          showToast({ type: "error", title: `${label} failed`, message: result.errorCode ? statusLabel(result.errorCode) : "The agent reported a failure." });
        } else {
          showToast({ type: "info", title: label, message: "Still running. It will appear in the list when it finishes." });
        }
      } catch (e) {
        showToast({ type: "error", title: label, message: getApiErrorMessage(e, "Unable to follow the job.") });
      } finally {
        setWorking((n) => n - 1);
        onFinished();
      }
    },
    [onFinished, showToast],
  );

  return { working, follow };
};
