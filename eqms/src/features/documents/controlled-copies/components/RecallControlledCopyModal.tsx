import React from "react";
import { FormModal } from "@/components/ui/modal/FormModal";

interface RecallControlledCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  controlledCopyNumber?: string;
  isBatch?: boolean;
}

// No Recall Date field here on purpose: the recall date is not a value to collect ahead of time --
// it IS the moment the recall is actually committed. Showing a pre-computed timestamp in this
// confirmation step (even read-only) would drift from the truth if the user takes any time to get
// through the next, electronic-signature step. The backend now leaves recallDate unset and lets
// the server stamp Instant.now() at the exact moment the recall transaction commits, right after
// the signature is verified -- the only timestamp that can honestly be called "contemporaneous".
export const RecallControlledCopyModal: React.FC<RecallControlledCopyModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  controlledCopyNumber,
  isBatch = false,
}) => {
  const targetLabel = isBatch ? "controlled-copy batch" : "controlled copy";

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Recall Controlled Copy"
      description={
        <>
          Confirm recalling this {targetLabel}
          {controlledCopyNumber ? ` (${controlledCopyNumber})` : ""}. The recall date will be
          recorded automatically at the moment you complete the electronic signature in the next
          step, and you will be asked for the reason there too.
        </>
      }
      confirmText="Continue to Signature"
      size="md"
    >
      <div />
    </FormModal>
  );
};
