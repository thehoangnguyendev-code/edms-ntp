import React from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Progress } from "@/components/ui/progress/Progress";

/**
 * Shown for the whole (single, atomic) import request, from the moment the e-signature is
 * confirmed until the response comes back -- the backend commits the document and every revision
 * in one transaction (see DocumentService#createLegacyImportDocumentAndRevisions), so there is no
 * real partial-progress signal to report and no partially-imported outcome to show: either every
 * revision below made it in, or (on any error) none did and the form reappears with the failure
 * cause. The bar therefore always slides rather than filling to a fabricated percentage.
 */
export const LegacyImportProgressModal: React.FC<{
  isOpen: boolean;
  sectionCount: number;
  stage: string;
}> = ({ isOpen, sectionCount, stage }) => {
  if (!isOpen) return null;
  return (
    <FormModal
      isOpen={isOpen}
      onClose={() => undefined}
      title="Legacy Import Processing"
      showFooter={false}
      size="md"
      className="max-w-md"
    >
      <div className="py-1">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-5 w-5 rounded-full border-2 border-emerald-200 border-t-emerald-600 animate-spin shrink-0" />
          <h3 className="text-sm font-semibold text-slate-900 flex-1">
            {stage || "Processing..."}
          </h3>
        </div>
        <p className="mb-4 text-xs sm:text-sm text-slate-500">
          Creating the document and importing {sectionCount > 1 ? `all ${sectionCount} historical revisions` : "the revision"} in a single all-or-nothing operation. This can take a while for many or large files -- please don't close this tab.
        </p>
        <Progress value={0} variant="emerald" size="md" indeterminate />
        <p className="mt-2.5 text-xs sm:text-sm text-slate-500">
          If anything fails, nothing is imported and you'll be brought back here with the exact issue to fix -- the document is never left half-imported.
        </p>
      </div>
    </FormModal>
  );
};
