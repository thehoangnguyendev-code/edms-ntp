import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Progress } from "@/components/ui/progress/Progress";
import { tr, trFormat } from "@/i18n";
import { BATCH_ACTION_COPY, type BatchActionLabel } from "./batchActionCopy";

interface DistributeBatchProgressModalProps {
  isOpen: boolean;
  processed: number;
  total: number;
  failed?: number;
  status: "in_progress" | "completed" | "completed_with_errors";
  /** Which batch action the wording is about. */
  actionLabel?: BatchActionLabel;
}

export const DistributeBatchProgressModal: React.FC<DistributeBatchProgressModalProps> = ({
  isOpen,
  processed,
  total,
  failed = 0,
  status,
  actionLabel = "Distribution",
}) => {
  if (!isOpen) {
    return null;
  }

  const safeTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((processed / safeTotal) * 100));
  const succeeded = Math.max(processed - failed, 0);
  const isCompleted = status === "completed";
  const hasErrors = status === "completed_with_errors";
  const copy = BATCH_ACTION_COPY[actionLabel];

  return (
    <FormModal
      isOpen={isOpen}
      onClose={() => undefined}
      title={tr(copy.processing)}
      showFooter={false}
      size="md"
      className="max-w-md"
    >
      <div className="py-1">
        <div className="flex items-center gap-2.5 mb-4">
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : hasErrors ? (
            <AlertCircle className="h-5 w-5 text-red-600" />
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-emerald-200 border-t-emerald-600 animate-spin" />
          )}
          <h3 className="text-sm font-semibold text-slate-900 flex-1">
            {isCompleted ? tr(copy.complete) : hasErrors ? tr(copy.errors) : tr("Processing controlled copy files...")}
          </h3>
          {total > 1 && (
            <span className="text-xs font-semibold text-slate-500 tabular-nums shrink-0">
              {Math.min(processed, total)} / {total}
            </span>
          )}
        </div>

        {!isCompleted && !hasErrors && (
          <p className="mb-4 text-xs sm:text-sm text-slate-500">
            {tr("The system is processing the Controlled Copy information. Please wait a moment.")}
          </p>
        )}

        {/* A single copy is one synchronous request/response -- there is no real partial-progress
            signal to report until it resolves, so a value-based bar would sit frozen at 0% the
            whole time. Show it sliding instead of fabricating a percentage. */}
        <Progress
          value={percent}
          variant={hasErrors ? "error" : "emerald"}
          size="md"
          indeterminate={!isCompleted && !hasErrors && total <= 1}
        />

        <p className="mt-2.5 text-xs sm:text-sm text-slate-500 tabular-nums">
          {isCompleted
            ? trFormat(
                total === 1
                  ? "Successfully processed {succeeded} of {total} controlled copy."
                  : "Successfully processed {succeeded} of {total} controlled copies.",
                { succeeded, total },
              )
            : hasErrors
              ? trFormat(
                  failed === 1
                    ? "Successfully processed {succeeded} of {total}. {failed} controlled copy could not be processed and can be retried."
                    : "Successfully processed {succeeded} of {total}. {failed} controlled copies could not be processed and can be retried.",
                  { succeeded, total, failed },
                )
              : trFormat("Successfully processed {succeeded} of {total}. Processing copy {current}...", {
                  succeeded,
                  total,
                  current: Math.min(processed + 1, safeTotal),
                })}
        </p>
      </div>
    </FormModal>
  );
};
