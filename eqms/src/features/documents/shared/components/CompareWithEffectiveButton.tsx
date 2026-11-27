import { useEffect, useState } from "react";
import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { documentApi } from "@/services/api/documents";
import { OnlyOfficeDocumentViewer } from "./OnlyOfficeDocumentViewer";
import { tr, trFormat } from "@/i18n";

/**
 * "Compare with Effective": what the revision being worked on changed against the Effective revision, in a read-only viewer. The server says whether it can be offered;
 * a comparison that cannot be made shows the viewer's error, never an empty "no changes" page.
 */
export const CompareWithEffectiveButton = ({ revisionId }: { revisionId: string }) => {
  const [baseline, setBaseline] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBaseline(null);
    documentApi
      .getRevisionComparisonInfo(revisionId)
      .then((info) => {
        if (!cancelled && info.comparisonAvailable) setBaseline(info.baselineRevisionNumber ?? "");
      })
      .catch(() => {
        // The button is an aid: without the server's answer it is simply not offered.
      });
    return () => {
      cancelled = true;
    };
  }, [revisionId]);

  if (baseline === null) return null;

  return (
    <>
      <Button type="button" size="sm" variant="outline-emerald" className="gap-2 whitespace-nowrap" onClick={() => setOpen(true)}>
        <GitCompare className="h-4 w-4" />
        {tr("Compare with Effective")}
      </Button>
      <FormModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
        title={trFormat("Changes since effective revision {revision}", { revision: baseline })}
        confirmText="Close"
        showCancel={false}
        size="3xl"
        className="max-w-[min(96vw,1600px)]"
      >
        {open && (
          <div className="space-y-2">
            <p className="text-xs sm:text-sm text-slate-600">
              {tr("Reading aid only: added text is underlined and removed text is struck through. Reviewers and approvers remain responsible for the whole document.")}
            </p>
            <OnlyOfficeDocumentViewer
              revisionId={`compare-${revisionId}`}
              height="calc(100dvh - 15rem)"
              watchForChanges={false}
              loadConfig={() => documentApi.getRevisionComparisonConfig(revisionId)}
            />
          </div>
        )}
      </FormModal>
    </>
  );
};
