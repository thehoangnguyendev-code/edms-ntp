import React, { useEffect, useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import type { RestoreRequestRecord } from "@/services/api/backupRestore";

/**
 * The reason for rejecting a restore request. It holds its own text: the caller re-renders on every change of its own state, and
 * the reason must not be re-rendered with it. The caller then asks for the electronic signature with the reason in hand.
 */
export const RejectRestoreDialog: React.FC<{
  request?: RestoreRequestRecord;
  busy: boolean;
  onClose: () => void;
  onNext: (reason: string) => void;
}> = ({ request, busy, onClose, onNext }) => {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!request) setReason("");
  }, [request]);
  return (
    <FormModal
      isOpen={!!request}
      onClose={onClose}
      title={`Reject ${request?.requestId ?? "restore"}`}
      description="The request is kept in the history as rejected. Say why, then sign to confirm."
      confirmText="Continue to sign"
      confirmDisabled={!reason.trim() || busy}
      onConfirm={() => onNext(reason.trim())}
    >
      <FormField label="Reason" required>
        <Textarea rows={3} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
      </FormField>
    </FormModal>
  );
};
