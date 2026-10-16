import { useEffect, useState } from "react";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { reportError } from "@/services/api/reportTemplates";

/** A confirmation with a reason for an action on a template (Disable, Enable, Discard Revision). The server decides whether the action is allowed. */
export function ReportTemplateReasonModal({
  isOpen,
  title,
  description,
  confirmText,
  reasonRequired,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText: string;
  reasonRequired: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setError("");
    }
  }, [isOpen]);

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setError(reportError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      confirmText={confirmText}
      confirmDisabled={(reasonRequired && !reason.trim()) || busy}
      onConfirm={() => void confirm()}
    >
      <FormField label={reasonRequired ? "Reason" : "Reason (optional)"} required={reasonRequired}>
        <Textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
      </FormField>
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </FormModal>
  );
}
