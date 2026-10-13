import React, { useEffect, useState } from "react";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { backupRestoreApi, type RestoreRequestRecord } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { RejectRestoreDialog } from "./RejectRestoreDialog";

export interface RestoreDecision {
  request: RestoreRequestRecord;
  mode: "approve" | "reject";
}

/**
 * Approving and rejecting a restore request, the same way from every screen. Approving asks for the approver's e-signature. Rejecting
 * asks for a reason first, then for the e-signature. The request is decided only when the server accepts the signature.
 */
export const RestoreDecisionDialogs: React.FC<{
  decision?: RestoreDecision;
  onClose: () => void;
  onDecided: (updated: RestoreRequestRecord, mode: RestoreDecision["mode"]) => void;
}> = ({ decision, onClose, onDecided }) => {
  const { showToast } = useToast();
  const [reason, setReason] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!decision) setReason(undefined);
  }, [decision]);

  const decide = async (mode: RestoreDecision["mode"], restoreNumber: string, token: string, why?: string) => {
    setBusy(true);
    try {
      const updated = mode === "approve"
        ? await backupRestoreApi.approveRestoreRequest(restoreNumber, token)
        : await backupRestoreApi.rejectRestoreRequest(restoreNumber, why ?? "", token);
      showToast({
        type: "success",
        title: mode === "approve" ? "Restore approved" : "Restore rejected",
        message: mode === "approve" ? `${updated.restoreNumber}. The administrators who can run it have been notified.` : updated.restoreNumber,
      });
      onDecided(updated, mode);
    } catch (e) {
      showToast({
        type: "error",
        title: mode === "approve" ? "The restore was not approved" : "The restore was not rejected",
        message: getApiErrorMessage(e, "The request was refused."),
      });
    } finally {
      setBusy(false);
    }
  };

  const signed = (mode: RestoreDecision["mode"]) => (data: { signatureToken?: string }) => {
    if (!decision) return;
    const { request } = decision;
    const why = reason;
    onClose();
    if (!data.signatureToken) {
      showToast({ type: "error", title: "The signature could not be confirmed", message: "Try again." });
      return;
    }
    return decide(mode, request.restoreNumber, data.signatureToken, why);
  };

  const rejectingReason = decision?.mode === "reject" && reason === undefined;
  const rejectingSign = decision?.mode === "reject" && reason !== undefined;

  return (
    <>
      <ESignatureModal
        isOpen={decision?.mode === "approve"}
        onClose={onClose}
        deferConfirm
        onConfirm={signed("approve")}
        actionTitle={`Approve restore ${decision?.request.restoreNumber ?? ""}`}
        meaningDisplayName="Backup Restore Approval"
        meaningCode="BACKUP_RESTORE_APPROVAL"
      />
      <RejectRestoreDialog
        request={rejectingReason ? decision?.request : undefined}
        busy={busy}
        onClose={onClose}
        onNext={(text) => setReason(text)}
      />
      <ESignatureModal
        isOpen={rejectingSign}
        onClose={onClose}
        deferConfirm
        onConfirm={signed("reject")}
        actionTitle={`Reject restore ${decision?.request.restoreNumber ?? ""}`}
        meaningDisplayName="Backup Restore Rejection"
        meaningCode="BACKUP_RESTORE_REJECTION"
      />
    </>
  );
};
