import React, { useState } from "react";
import { Upload } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";

interface RecallControlledCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** completedFile is set only when the "form was completed" toggle is on and a scan was
   *  attached -- the caller then posts to the combined recall-with-executed-record endpoint
   *  instead of the plain recall endpoint. */
  onConfirm: (completedFile: File | null) => void;
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
  const [formCompleted, setFormCompleted] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleClose = () => {
    setFormCompleted(false);
    setFile(null);
    onClose();
  };

  const handleConfirm = () => {
    const completedFile = formCompleted ? file : null;
    setFormCompleted(false);
    setFile(null);
    onConfirm(completedFile);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      confirmDisabled={formCompleted && !file}
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
      {!isBatch && (
        <div className="space-y-3">
          <Checkbox
            id="recall-form-completed"
            label="This Form was filled in and signed by hand -- attach the executed scan"
            checked={formCompleted}
            onChange={setFormCompleted}
          />
          {formCompleted && (
            <label
              htmlFor="recall-executed-scan-file"
              className="flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-center hover:border-emerald-400 hover:bg-emerald-50/40"
            >
              <Upload className="h-5 w-5 text-slate-400" />
              <span className="text-xs text-slate-600">
                {file ? file.name : "Click to select the scanned, signed form"}
              </span>
              <input
                id="recall-executed-scan-file"
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>
      )}
    </FormModal>
  );
};
