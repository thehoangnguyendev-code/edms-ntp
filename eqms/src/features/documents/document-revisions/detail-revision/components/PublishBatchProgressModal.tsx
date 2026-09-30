import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Progress } from "@/components/ui/progress/Progress";

interface PublishBatchProgressModalProps {
  isOpen: boolean;
  status: "in_progress" | "completed" | "failed";
  /** Display labels of the Related Documents publishing together with the primary one. */
  relatedLabels: string[];
  errorMessage?: string;
}

/** Same visual language as Controlled Copy's DistributeBatchProgressModal, adapted for a single
 *  synchronous publish request that publishes several linked documents together in one action
 *  (no per-item progress signal exists -- the whole batch is one request/response). */
export const PublishBatchProgressModal: React.FC<PublishBatchProgressModalProps> = ({
  isOpen,
  status,
  relatedLabels,
  errorMessage,
}) => {
  if (!isOpen) {
    return null;
  }

  const total = relatedLabels.length + 1;
  const isCompleted = status === "completed";
  const hasErrors = status === "failed";

  return (
    <FormModal
      isOpen={isOpen}
      onClose={() => undefined}
      title="Publish processing"
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
            {isCompleted
              ? "Publish complete"
              : hasErrors
                ? "Publish failed"
                : "Publishing document package..."}
          </h3>
          <span className="text-xs font-semibold text-slate-500 tabular-nums shrink-0">
            {total} {total === 1 ? "document" : "documents"}
          </span>
        </div>

        {!isCompleted && !hasErrors && (
          <p className="mb-4 text-xs sm:text-sm text-slate-500">
            Publishing this document together with its Related Document(s). Please wait a moment.
          </p>
        )}

        {/* One atomic request/response -- there is no real partial-progress signal until it
            resolves, so show the bar sliding (indeterminate) instead of a fabricated percentage. */}
        <Progress
          value={isCompleted ? 100 : 0}
          variant={hasErrors ? "error" : "emerald"}
          size="md"
          indeterminate={!isCompleted && !hasErrors}
        />

        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1 text-xs text-slate-700">
          <div className="font-medium text-slate-800">This revision</div>
          {relatedLabels.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>

        <p className="mt-2.5 text-xs sm:text-sm text-slate-500">
          {isCompleted
            ? `Successfully published ${total} of ${total} document(s).`
            : hasErrors
              ? errorMessage || "The document package could not be published."
              : "This may take a few seconds..."}
        </p>
      </div>
    </FormModal>
  );
};
