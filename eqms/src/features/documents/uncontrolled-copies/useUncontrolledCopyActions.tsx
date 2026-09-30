import React, { useCallback, useState } from "react";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { uncontrolledCopyApi, type UncontrolledCopy } from "@/services/api/uncontrolledCopy";

export type UncontrolledCopyAction = "approve" | "reject" | "generate" | "distribute" | "cancel";
type SignedAction = Exclude<UncontrolledCopyAction, "generate">;

/** Meaning codes match the backend's createEntitySignature meanings (UNCONTROLLED_COPY_*). */
const SIGNED_ACTIONS: Record<SignedAction, { title: string; meaningDisplayName: string; meaningCode: string; toStatus: string; done: string }> = {
  approve: {
    title: "Approve Uncontrolled Copy Request",
    meaningDisplayName: "Uncontrolled Copy Approved",
    meaningCode: "UNCONTROLLED_COPY_APPROVED",
    toStatus: "Approved",
    done: "Request approved.",
  },
  reject: {
    title: "Reject Uncontrolled Copy Request",
    meaningDisplayName: "Uncontrolled Copy Rejected",
    meaningCode: "UNCONTROLLED_COPY_REJECTED",
    toStatus: "Rejected",
    done: "Request rejected.",
  },
  distribute: {
    title: "Distribute Uncontrolled Copy",
    meaningDisplayName: "Uncontrolled Copy Distributed",
    meaningCode: "UNCONTROLLED_COPY_DISTRIBUTED",
    toStatus: "Distributed",
    done: "Copy distributed. The recipient e-mail is being sent in the background.",
  },
  cancel: {
    title: "Cancel Uncontrolled Copy Request",
    meaningDisplayName: "Uncontrolled Copy Cancelled",
    meaningCode: "UNCONTROLLED_COPY_CANCELLED",
    toStatus: "Cancelled",
    done: "Request cancelled.",
  },
};

interface Pending {
  action: SignedAction;
  copies: UncontrolledCopy[];
}

export const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

/**
 * Runs the Uncontrolled Copy lifecycle actions for list + detail views. Every state-changing action except
 * Generate goes through the e-signature modal (its mandatory reason is sent as the action reason); the server
 * re-checks permission and status, the UI only mirrors `copy.capabilities`.
 */
export function useUncontrolledCopyActions(onChanged: () => void) {
  const { showToast } = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const runAction = useCallback(
    async (copy: UncontrolledCopy, action: UncontrolledCopyAction) => {
      if (action !== "generate") {
        setPending({ action, copies: [copy] });
        return;
      }
      setBusyId(copy.id);
      try {
        await uncontrolledCopyApi.generateUncontrolledCopy(copy.id);
        showToast({ type: "success", title: "Generated", message: "The watermarked copy was generated." });
        onChanged();
      } catch (error) {
        showToast({ type: "error", title: "Error", message: extractApiMessage(error, "Unable to generate the uncontrolled copy.") });
      } finally {
        setBusyId(null);
      }
    },
    [onChanged, showToast],
  );

  const distributeBatch = useCallback((copies: UncontrolledCopy[]) => {
    if (copies.length > 0) setPending({ action: "distribute", copies });
  }, []);

  const openFile = useCallback(
    async (copy: UncontrolledCopy, mode: "preview" | "download") => {
      setBusyId(copy.id);
      try {
        const file =
          mode === "preview"
            ? await uncontrolledCopyApi.previewUncontrolledCopy(copy.id)
            : await uncontrolledCopyApi.downloadUncontrolledCopy(copy.id);
        if (mode === "preview") {
          const url = URL.createObjectURL(file.blob);
          window.open(url, "_blank", "noopener");
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } else {
          saveBlob(file.blob, file.fileName);
          onChanged();
        }
      } catch (error) {
        showToast({ type: "error", title: "Error", message: extractApiMessage(error, "Unable to open the uncontrolled copy file.") });
      } finally {
        setBusyId(null);
      }
    },
    [onChanged, showToast],
  );

  const handleConfirm = async (data: { signatureToken: string; reason?: string }) => {
    if (!pending) return;
    const payload = { signatureToken: data.signatureToken, reason: data.reason };
    const { action, copies } = pending;
    // Errors are rethrown so the signature modal shows them and stays open.
    if (action === "distribute" && copies.length > 1) {
      await uncontrolledCopyApi.distributeUncontrolledCopyBatch(copies.map((c) => c.id), payload);
    } else {
      const id = copies[0].id;
      if (action === "approve") await uncontrolledCopyApi.approveUncontrolledCopyRequest(id, payload);
      else if (action === "reject") await uncontrolledCopyApi.rejectUncontrolledCopyRequest(id, payload);
      else if (action === "distribute") await uncontrolledCopyApi.distributeUncontrolledCopy(id, payload);
      else await uncontrolledCopyApi.cancelUncontrolledCopy(id, payload);
    }
    showToast({ type: "success", title: "Success", message: SIGNED_ACTIONS[action].done });
    setPending(null);
    onChanged();
  };

  const config = pending ? SIGNED_ACTIONS[pending.action] : null;
  const first = pending?.copies[0];
  const signatureModal =
    pending && config && first ? (
      <ESignatureModal
        isOpen
        onClose={() => setPending(null)}
        onConfirm={handleConfirm}
        actionTitle={pending.copies.length > 1 ? `${config.title} (${pending.copies.length} copies)` : config.title}
        meaningDisplayName={config.meaningDisplayName}
        meaningCode={config.meaningCode}
        changes={[{ action: "Update Status", oldValue: first.status, newValue: config.toStatus, category: "status" }]}
        targetDetails={{
          code: pending.copies.length > 1 ? `${pending.copies.length} uncontrolled copies` : first.uncontrolledCopyNumber,
          title: first.documentTitle || first.documentNumber,
          revision: first.revisionNumber || "—",
        }}
      />
    ) : null;

  return { runAction, distributeBatch, openFile, busyId, signatureModal };
}
