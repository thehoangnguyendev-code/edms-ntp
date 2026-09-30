import React, { useEffect, useState } from "react";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import {
  uncontrolledCopyApi,
  type UncontrolledCopy,
} from "@/services/api/uncontrolledCopy";

/** Loads the server-authorized uncontrolled-copy preview only while the Document tab is open. */
export const UncontrolledCopyDocumentTab: React.FC<{
  copy: UncontrolledCopy;
}> = ({ copy }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!copy.capabilities.canPreview) {
      setLoading(false);
      setUrl(null);
      setError(null);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);
    uncontrolledCopyApi
      .previewUncontrolledCopy(copy.id)
      .then((file) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(file.blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (!active) return;
        setUrl(null);
        setError(
          extractApiMessage(
            err,
            "The uncontrolled copy preview could not be loaded.",
          ),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [copy.id, copy.statusCode, copy.updatedAt, copy.capabilities.canPreview]);

  return (
    <div className="space-y-4 md:space-y-5">
      {!copy.capabilities.canPreview ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-600">
          The generated file is not available for preview in your current access
          scope.
        </div>
      ) : loading ? (
        <FullPageLoading text="Loading uncontrolled copy document..." />
      ) : error || !url ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-600">
          {error || "The uncontrolled copy file is not available."}
        </div>
      ) : (
        <div
          className="select-none"
          onContextMenu={(event) => event.preventDefault()}
        >
          <DocumentPdfViewer
            fileUrl={url}
            allowDownload={copy.capabilities.canDownload}
            allowPrint={copy.capabilities.canDownload}
            allowContextMenu={false}
          />
        </div>
      )}
    </div>
  );
};
