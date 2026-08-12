import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Progress } from "@/components/ui/progress/Progress";

interface DistributeBatchProgressModalProps {
  isOpen: boolean;
  processed: number;
  total: number;
  failed?: number;
  status: "in_progress" | "completed" | "completed_with_errors";
  /** e.g. "Distribution" (default) or "Recall" — customizes the modal's wording. */
  actionLabel?: string;
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

  return (
    <FormModal
      isOpen={isOpen}
      onClose={() => undefined}
      title={`${actionLabel} processing`}
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
          <h3 className="text-sm font-semibold text-slate-900">
            {isCompleted ? `${actionLabel} complete` : hasErrors ? `${actionLabel} completed with errors` : "Processing controlled copy files..."}
          </h3>
        </div>

        {!isCompleted && !hasErrors && (
          <p className="mb-4 text-xs sm:text-sm text-slate-500">
            The system is processing the Controlled Copy information. Please wait a moment.
          </p>
        )}

        <Progress value={percent} variant={hasErrors ? "error" : "emerald"} size="md" />

        <p className="mt-2.5 text-xs sm:text-sm text-slate-500 tabular-nums">
          {isCompleted
            ? `Successfully processed ${succeeded} of ${total} controlled ${total === 1 ? "copy" : "copies"}.`
            : hasErrors
              ? `Successfully processed ${succeeded} of ${total}. ${failed} controlled ${failed === 1 ? "copy" : "copies"} could not be processed and can be retried.`
            : `Successfully processed ${succeeded} of ${total}. Processing copy ${Math.min(processed + 1, safeTotal)}...`}
        </p>
      </div>
    </FormModal>
  );
};
