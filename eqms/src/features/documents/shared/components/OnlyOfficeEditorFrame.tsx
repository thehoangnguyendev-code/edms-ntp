import { useEffect, useRef, useState } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { config } from "@/config";
import { documentApi } from "@/services/api/documents";
import { getApiErrorMessage } from "@/utils/apiError";
import { OnlyOfficeCapacityNotice } from "./OnlyOfficeCapacityNotice";

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (containerId: string, config: Record<string, unknown>) => { destroyEditor?: () => void };
    };
  }
}

interface OnlyOfficeEditorFrameProps {
  revisionId: string;
  title?: string;
  onClose: () => void;
}

const EDITOR_CONTAINER_ID = "onlyoffice-editor-container";

/**
 * Full-screen overlay embedding OnlyOffice Document Server's editor via its DocsAPI script --
 * the OnlyOffice counterpart to the "open Word Online in a new tab" flow used for Microsoft
 * Graph (see useOfficeOnlineReviewLink.ts). Unlike Graph, OnlyOffice's editor is meant to be
 * embedded in-page, not opened in a separate tab, so this renders as a modal overlay instead.
 *
 * The editor config (including its own signed JWT) comes fully-formed from the backend --
 * GET /revisions/:id/onlyoffice/edit-config -- which has already resolved the caller's permitted
 * mode (edit / review / comment-only) from the revision's lifecycle status. This component does
 * not make any editing-permission decisions itself.
 */
export const OnlyOfficeEditorFrame = ({ revisionId, title, onClose }: OnlyOfficeEditorFrameProps) => {
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const editorInstanceRef = useRef<{ destroyEditor?: () => void } | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [lockedReason, setLockedReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDocsApiScript = () =>
      new Promise<void>((resolve, reject) => {
        if (window.DocsAPI) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = `${config.onlyOffice.documentServerUrl}/web-apps/apps/api/documents/api.js`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Could not load the OnlyOffice editor script."));
        document.body.appendChild(script);
      });

    const init = async () => {
      try {
        const editorConfig = await documentApi.getRevisionOnlyOfficeEditConfig(revisionId);
        await loadDocsApiScript();
        if (cancelled) return;
        if (!window.DocsAPI) {
          throw new Error("OnlyOffice editor script did not load correctly.");
        }
        // DocsAPI replaces the element it is given with an iframe, so give it a throw-away holder inside a
        // React-owned host instead of an element React renders (avoids "insertBefore ... not a child").
        const host = hostRef.current;
        if (!host) return;
        const holder = document.createElement("div");
        holder.id = EDITOR_CONTAINER_ID;
        holder.style.width = "100%";
        holder.style.height = "100%";
        host.replaceChildren(holder);
        editorInstanceRef.current = new window.DocsAPI.DocEditor(EDITOR_CONTAINER_ID, {
          ...editorConfig,
          events: {
            onError: () => {
              setErrorMessage("The editor reported an error. If many people are online, the connection limit of the online editing service may have been reached; try again shortly.");
              setLoadState("error");
            },
          },
        });
        setLoadState("ready");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(getApiErrorMessage(error, "Unable to open the OnlyOffice editor for this revision."));
        setLoadState("error");
      }
    };

    void init();

    return () => {
      cancelled = true;
      editorInstanceRef.current?.destroyEditor?.();
      hostRef.current?.replaceChildren();
    };
  }, [revisionId]);

  // Close the editor the moment the revision moves to a stage that no longer allows this session
  // (Complete Editing, Submit, Complete/Reject Review/Approval done by anyone), instead of leaving
  // a live editor on screen until the user reloads.
  useEffect(() => {
    if (loadState !== "ready" || lockedReason) return;
    let cancelled = false;
    let baseline: string | null = null;
    const tick = async () => {
      try {
        const live = await documentApi.getRevisionById(revisionId);
        if (cancelled || !live) return;
        const signature = `${String(live.statusCode ?? live.status ?? "")}|${String(live.editingStatus ?? "")}|${String(live.sourceLocked ?? "")}`;
        if (baseline === null) {
          baseline = signature;
        } else if (baseline !== signature) {
          editorInstanceRef.current?.destroyEditor?.();
          editorInstanceRef.current = null;
          setLockedReason(`This revision has moved to "${String(live.status ?? live.statusCode ?? "another stage")}". The editor was closed so it cannot be changed further.`);
        }
      } catch {
        // transient failure -- next tick retries
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadState, lockedReason, revisionId]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <img
          src={`${config.api.baseURL}/branding/logo`}
          alt=""
          className="h-7 max-w-[240px] object-contain"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          aria-label="Close editor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <OnlyOfficeCapacityNotice kind="edit" className="mx-4 mt-2" />
      <div className="relative flex-1">
        {loadState === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading OnlyOffice editor...</span>
          </div>
        )}
        {loadState === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-slate-700">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}
        <div ref={hostRef} className="h-full w-full" />
        {lockedReason && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white px-6 text-center text-slate-700">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <span className="text-sm">{lockedReason}</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-emerald-600 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
