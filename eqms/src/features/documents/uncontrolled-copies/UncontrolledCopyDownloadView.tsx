import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Download, FileWarning, Loader2 } from "lucide-react";
import { uncontrolledCopyApi } from "@/services/api/uncontrolledCopy";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { saveBlob } from "./useUncontrolledCopyActions";

/**
 * Where the "Download" link in an Uncontrolled Copy distribution e-mail lands -- same pattern as
 * DcoBatchZipDownloadView: login is required (ProtectedRoute redirects to login and back), the server enforces
 * recipient/permission/validity, and this page only triggers the download and reports the outcome.
 */
export const UncontrolledCopyDownloadView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!id || startedRef.current || state !== "loading") return;
    startedRef.current = true;
    uncontrolledCopyApi
      .downloadUncontrolledCopy(id)
      .then(({ blob, fileName }) => {
        saveBlob(blob, fileName);
        setState("done");
      })
      .catch((error) => {
        setErrorMessage(extractApiMessage(error, "Unable to download the uncontrolled copy."));
        setState("error");
      });
  }, [id, state]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-emerald-600" />
            <h1 className="mt-4 text-base font-semibold text-slate-900">Preparing your download...</h1>
            <p className="mt-1 text-sm text-slate-500">Fetching the watermarked uncontrolled copy.</p>
          </>
        )}
        {state === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
            <h1 className="mt-4 text-base font-semibold text-slate-900">Download started</h1>
            <p className="mt-1 text-sm text-slate-500">
              This copy is for reference only and is not tracked or recalled -- always check the current revision before use.
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <FileWarning className="mx-auto h-9 w-9 text-rose-500" />
            <h1 className="mt-4 text-base font-semibold text-slate-900">Couldn't download the copy</h1>
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
