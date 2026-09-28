import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Download, FileWarning, Loader2 } from "lucide-react";
import { documentApi } from "@/services/api/documents";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";

/**
 * Where the "Download" link in the DCO's batch-ZIP email lands. Requires the visitor to already be
 * logged into eQMS (ProtectedRoute handles the redirect-to-login-and-back) and to hold the "Receive
 * Controlled Copies as DCO" permission -- the server enforces that, this page just triggers the
 * download and reports the outcome. Never a public/token link: the DCO is always an internal user.
 */
export const DcoBatchZipDownloadView: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!batchId || startedRef.current) return;
    startedRef.current = true;
    documentApi
      .downloadDcoBatchZip(batchId)
      .then(({ blob, fileName }) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        setState("done");
      })
      .catch((error) => {
        setErrorMessage(extractApiMessage(error, "Unable to download the batch ZIP."));
        setState("error");
      });
  }, [batchId]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-600" />
            <h1 className="mt-4 text-base font-semibold text-slate-900">Preparing your download...</h1>
            <p className="mt-1 text-sm text-slate-500">Rebuilding the ZIP of controlled copies for this batch.</p>
          </>
        )}
        {state === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h1 className="mt-4 text-base font-semibold text-slate-900">Download started</h1>
            <p className="mt-1 text-sm text-slate-500">
              If it didn't start automatically, your browser may have blocked the pop-up -- check its download bar, or reload
              this page to try again.
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <FileWarning className="mx-auto h-10 w-10 text-rose-500" />
            <h1 className="mt-4 text-base font-semibold text-slate-900">Couldn't prepare the download</h1>
            <p className="mt-1 text-sm text-slate-500">{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                startedRef.current = false;
                setState("loading");
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" />
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
};
