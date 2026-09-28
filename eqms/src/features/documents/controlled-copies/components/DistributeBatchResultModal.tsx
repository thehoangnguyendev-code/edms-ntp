import React from "react";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";

export interface DistributeBatchFailedItem {
  controlledCopyId: string;
  controlledCopyNumber: string;
  recipientName: string;
  lastErrorMessage?: string;
}

interface DistributeBatchResultModalProps {
  isOpen: boolean;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  failedItems: DistributeBatchFailedItem[];
  isRetrying: boolean;
  onRetryAllFailed: () => void;
  onClose: () => void;
  /** e.g. "Distribution" (default) or "Recall" — customizes the modal's wording. */
  actionLabel?: string;
  /** e.g. "Ready for Distribution" (default) or "Distributed" — the status failed copies were left in. */
  failedStatusLabel?: string;
}

export const DistributeBatchResultModal: React.FC<DistributeBatchResultModalProps> = ({
  isOpen,
  total,
  succeeded,
  failed,
  skipped,
  failedItems,
  isRetrying,
  onRetryAllFailed,
  onClose,
  actionLabel = "Distribution",
  failedStatusLabel = "Ready for Distribution",
}) => {
  if (!isOpen) {
    return null;
  }

  const hasErrors = failed > 0;
  const hasExceptions = hasErrors || skipped > 0;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${actionLabel} result`}
      size="md"
      className="max-w-lg"
      showFooter
      showCancel={hasErrors}
      cancelText="Close"
      confirmText={hasErrors ? (isRetrying ? "Retrying..." : "Retry All Failed") : "OK"}
      confirmVariant="default"
      isLoading={isRetrying}
      onConfirm={hasErrors ? onRetryAllFailed : onClose}
    >
      <div className="py-1">
        <div className="flex items-center gap-2.5 mb-4">
          {hasExceptions ? (
            <IconAlertTriangle className="h-5 w-5 text-red-600" />
          ) : (
            <IconCheck className="h-5 w-5 text-emerald-600" />
          )}
          <h3 className="text-sm font-semibold text-slate-900">
            {hasExceptions ? `${actionLabel} completed with exceptions` : `${actionLabel} complete`}
          </h3>
        </div>

        <div className="grid grid-cols-4 gap-2.5 mb-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
            <p className="text-lg font-semibold text-slate-900 tabular-nums">{total}</p>
            <p className="text-2xs text-slate-500 uppercase tracking-wider">Total</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center">
            <p className="text-lg font-semibold text-emerald-700 tabular-nums">{succeeded}</p>
            <p className="text-2xs text-emerald-600 uppercase tracking-wider">Succeeded</p>
          </div>
          <div className={`rounded-lg border px-3 py-2.5 text-center ${hasErrors ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
            <p className={`text-lg font-semibold tabular-nums ${hasErrors ? "text-red-700" : "text-slate-400"}`}>{failed}</p>
            <p className={`text-2xs uppercase tracking-wider ${hasErrors ? "text-red-600" : "text-slate-400"}`}>Failed</p>
          </div>
          <div className={`rounded-lg border px-3 py-2.5 text-center ${skipped > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
            <p className={`text-lg font-semibold tabular-nums ${skipped > 0 ? "text-amber-700" : "text-slate-400"}`}>{skipped}</p>
            <p className={`text-2xs uppercase tracking-wider ${skipped > 0 ? "text-amber-600" : "text-slate-400"}`}>Skipped</p>
          </div>
        </div>

        {skipped > 0 && (
          <p className="mb-4 text-xs sm:text-sm text-amber-700">
            Skipped controlled copies had already reached a terminal lifecycle state and were not processed or retried.
          </p>
        )}

        {hasErrors && (
          <div className="space-y-2">
            <p className="text-xs sm:text-sm text-slate-600">
              These controlled copies were left as <span className="font-medium">{failedStatusLabel}</span> and can be retried:
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {failedItems.map((item) => (
                <div key={item.controlledCopyId} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-medium text-slate-800">{item.controlledCopyNumber}</span>
                    <span className="text-2xs text-slate-500">{item.recipientName || "-"}</span>
                  </div>
                  {item.lastErrorMessage && (
                    <p className="mt-0.5 text-2xs text-red-600 truncate" title={item.lastErrorMessage}>
                      {item.lastErrorMessage}
                    </p>
                  )}
                </div>
              ))}
              {failedItems.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-400">Loading failed copies...</p>
              )}
            </div>
            {isRetrying && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Retrying failed copies...
              </p>
            )}
          </div>
        )}
      </div>
    </FormModal>
  );
};
