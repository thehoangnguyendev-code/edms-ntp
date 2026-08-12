import React, { useEffect, useMemo, useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";

export interface RecallControlledCopyValues {
  recallDate: string;
  recallReason: string;
}

interface RecallControlledCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (values: RecallControlledCopyValues) => void;
  controlledCopyNumber?: string;
  isBatch?: boolean;
}

const getTodayLocal = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export const RecallControlledCopyModal: React.FC<RecallControlledCopyModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  controlledCopyNumber,
  isBatch = false,
}) => {
  const today = useMemo(getTodayLocal, []);
  const [recallDate, setRecallDate] = useState(today);
  const [recallReason, setRecallReason] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof RecallControlledCopyValues, string>>>({});

  useEffect(() => {
    if (!isOpen) return;
    setRecallDate(today);
    setRecallReason("");
    setErrors({});
  }, [isOpen, today]);

  const handleConfirm = () => {
    const normalizedReason = recallReason.trim();
    const nextErrors: Partial<Record<keyof RecallControlledCopyValues, string>> = {};
    if (!recallDate) nextErrors.recallDate = "Recall date is required.";
    if (!normalizedReason) nextErrors.recallReason = "Reason for recall is required.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onConfirm({ recallDate, recallReason: normalizedReason });
  };

  const targetLabel = isBatch ? "controlled-copy batch" : "controlled copy";

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Recall Controlled Copy"
      description={
        <>Record the actual recall date and a clear reason before recalling this {targetLabel}{controlledCopyNumber ? ` (${controlledCopyNumber})` : ""}.</>
      }
      confirmText="Save and Continue"
      size="md"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="controlled-copy-recall-date" className="text-sm font-medium text-slate-700">
            Recall Date <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="controlled-copy-recall-date"
            type="date"
            value={recallDate}
            max={today}
            onChange={(event) => {
              setRecallDate(event.target.value);
              setErrors((current) => ({ ...current, recallDate: undefined }));
            }}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-1 ${errors.recallDate ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"}`}
            aria-invalid={Boolean(errors.recallDate)}
            aria-describedby={errors.recallDate ? "controlled-copy-recall-date-error" : undefined}
          />
          {errors.recallDate && <p id="controlled-copy-recall-date-error" className="text-xs text-red-600">{errors.recallDate}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="controlled-copy-recall-reason" className="text-sm font-medium text-slate-700">
            Reason for Recall <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <textarea
            id="controlled-copy-recall-reason"
            value={recallReason}
            onChange={(event) => {
              setRecallReason(event.target.value);
              setErrors((current) => ({ ...current, recallReason: undefined }));
            }}
            rows={4}
            maxLength={1000}
            placeholder="Example: A new document revision has replaced this copy."
            className={`w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-1 ${errors.recallReason ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"}`}
            aria-invalid={Boolean(errors.recallReason)}
            aria-describedby={errors.recallReason ? "controlled-copy-recall-reason-error" : undefined}
          />
          <div className="flex justify-between gap-3">
            {errors.recallReason ? <p id="controlled-copy-recall-reason-error" className="text-xs text-red-600">{errors.recallReason}</p> : <span />}
            <span className="text-xs text-slate-400">{recallReason.length}/1000</span>
          </div>
        </div>
      </div>
    </FormModal>
  );
};
