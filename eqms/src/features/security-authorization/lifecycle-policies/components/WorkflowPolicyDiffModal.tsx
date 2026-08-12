import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Badge } from "@/components/ui/badge/Badge";
import type { WorkflowActionPolicyPreviewResponse } from "../types";
import { IconCheck } from "@tabler/icons-react";

interface WorkflowPolicyDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  preview: WorkflowActionPolicyPreviewResponse | null;
  isLoading?: boolean;
}

export const WorkflowPolicyDiffModal: React.FC<WorkflowPolicyDiffModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  preview,
  isLoading,
}) => {
  const hasChanges = (preview?.changes?.length ?? 0) > 0;
  const hasWarnings = (preview?.warnings?.length ?? 0) > 0;
  const isPreviewValid = preview?.valid === true;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Preview Changes"
      description={isPreviewValid
        ? "Review the changes before saving. This action cannot be undone."
        : "The server rejected this configuration. Correct the validation error before saving."}
      confirmText="Confirm Save"
      cancelText="Cancel"
      isLoading={isLoading}
      confirmDisabled={!isPreviewValid}
      showCancel
      size="lg"
    >
      {preview && (
        <div className="flex flex-col gap-4">
          {!isPreviewValid && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>The preview is invalid. Confirmation is disabled until the policy is corrected.</p>
            </div>
          )}
          {/* Changes list */}
          {hasChanges ? (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Changes
              </p>
              <div className="flex flex-col gap-2">
                {preview.changes.map((change, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm"
                  >
                    <span className="font-medium text-slate-700 capitalize">
                      {change.field.replace(/_/g, " ")}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded line-through">
                        {change.oldValue ?? "(none)"}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                        {change.newValue ?? "(none)"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
              <IconCheck className="h-4 w-4 text-emerald-500" />
              No changes detected.
            </div>
          )}

          {/* Warnings */}
          {hasWarnings && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Warnings
              </p>
              <div className="flex flex-col gap-2">
                {preview.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <Badge color="amber" size="xs" className="mb-1">
                        {w.code}
                      </Badge>
                      <p className="text-amber-800 text-xs">{w.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Would affect */}
          {preview.wouldAffect && (
            <div className="text-xs text-slate-500 border-t border-slate-100 pt-3">
              Affects:{" "}
              <span className="text-slate-700">
                {preview.wouldAffect.workflowKey} / {preview.wouldAffect.actionCode} / {preview.wouldAffect.fromStatus}
                {preview.wouldAffect.documentTypeId ? ` (doc type: ${preview.wouldAffect.documentTypeId})` : " (global)"}
              </span>
            </div>
          )}
        </div>
      )}
    </FormModal>
  );
};
