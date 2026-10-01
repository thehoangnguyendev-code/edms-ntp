import React, { useEffect, useRef, useState } from "react";
import { X, Loader2, AlertTriangle, Check } from "lucide-react";
import { config } from "@/config";
import { getApiErrorMessage } from "@/utils/apiError";
import { Button } from "@/components/ui/button";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast/Toast";
import { CONTENT_CHANGED_SINCE_DESIGN_PREFIX, eformSessionApi, type EformSessionKind } from "@/services/api/eformSessions";

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (containerId: string, config: Record<string, unknown>) => { destroyEditor?: () => void };
    };
  }
}

const EDITOR_CONTAINER_ID = "eform-session-editor-container";

/**
 * Shared shell for both live OnlyOffice Form sessions: an Author designing fillable fields on a
 * Form ("DESIGN", scoped to the Form itself) and an end user filling/signing them in-browser
 * ("FILL", scoped to one electronic Controlled Copy distribution -- see the approved plan
 * "Form / eForm -- Phase 2b: Per-Distribution Sequential Signer Assignment"). Mirrors
 * `OnlyOfficeEditorFrame.tsx`'s embedding shell, driven by a session id instead of a revisionId.
 * `DesignEformFieldsFrame`/`FillEformFrame` are thin, differently-labelled wrappers around this.
 */
export const EformSessionFrame: React.FC<{
  /** DESIGN only. */
  formDocumentId?: string;
  /** FILL only. */
  controlledCopyId?: string;
  kind: EformSessionKind;
  title: string;
  footerActionLabel: string;
  signatureMeaningCode: string;
  /** FILL only -- which OnlyOffice Form Role this session fills. Leave undefined for the initial
   *  data-entry phase or a Form with no roles configured. See EformSignerAssignmentService on the
   *  backend for the enforcement. */
  roleName?: string;
  onClose: (committed: boolean) => void;
}> = ({ formDocumentId, controlledCopyId, kind, title, footerActionLabel, signatureMeaningCode, roleName, onClose }) => {
  const { showToast } = useToast();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [staleContentWarning, setStaleContentWarning] = useState<string | null>(null);
  const editorInstanceRef = useRef<{ destroyEditor?: () => void } | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cancelledRef = useRef(false);

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

  const mountEditor = async (sessionIdValue: string) => {
    const editorConfig = await eformSessionApi.getEditConfig(sessionIdValue);
    await loadDocsApiScript();
    if (cancelledRef.current) return;
    if (!window.DocsAPI) {
      throw new Error("OnlyOffice editor script did not load correctly.");
    }
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
  };

  const init = async (acknowledgeStaleContent = false) => {
    setLoadState("loading");
    try {
      const session = kind === "DESIGN"
        ? await eformSessionApi.startDesignSession(formDocumentId as string, acknowledgeStaleContent)
        : await eformSessionApi.startFillSession(controlledCopyId as string, roleName);
      if (cancelledRef.current) return;
      setSessionId(session.id);
      await mountEditor(session.id);
    } catch (error) {
      if (cancelledRef.current) return;
      const message = getApiErrorMessage(error, "Unable to open the OnlyOffice editor.");
      if (message.startsWith(CONTENT_CHANGED_SINCE_DESIGN_PREFIX)) {
        setStaleContentWarning(message.slice(CONTENT_CHANGED_SINCE_DESIGN_PREFIX.length).trim());
        return;
      }
      setErrorMessage(message);
      setLoadState("error");
    }
  };

  useEffect(() => {
    cancelledRef.current = false;
    void init();

    return () => {
      cancelledRef.current = true;
      editorInstanceRef.current?.destroyEditor?.();
      hostRef.current?.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formDocumentId, controlledCopyId, kind, roleName]);

  const handleClose = () => {
    if (sessionId) void eformSessionApi.abandonSession(sessionId).catch(() => undefined);
    onClose(false);
  };

  const handleActionClick = async () => {
    if (!sessionId) return;
    setIsSaving(true);
    try {
      // Flush any unsaved edits now rather than waiting for the editor's own autosave interval;
      // the resulting callback lands asynchronously, so give it a brief moment before signing.
      await eformSessionApi.forceSave(sessionId);
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      setIsSigning(true);
    } catch (error) {
      showToast({ type: "error", title: "Error", message: getApiErrorMessage(error, "Unable to save your changes.") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSigned = async (data: { reason: string; signatureToken: string }) => {
    if (!sessionId) return;
    if (kind === "DESIGN") {
      await eformSessionApi.commitDesign(sessionId, data.reason, data.signatureToken);
      showToast({ type: "success", title: "Saved", message: "eForm fields have been saved." });
    } else {
      const result = await eformSessionApi.completeFillStep(sessionId, data.reason, data.signatureToken);
      if (result.completed) {
        showToast({ type: "success", title: "Submitted", message: "The filled eForm has been submitted." });
      } else {
        showToast({
          type: "success",
          title: "Signed",
          message: "Your part has been signed -- the next signer can now continue.",
        });
      }
    }
    setIsSigning(false);
    onClose(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div>
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          {kind === "DESIGN" && (
            <p className="text-xs text-slate-500">
              Lays out fillable fields on top of this Form's current Draft content -- to edit the content itself, use the
              Document tab's own Edit button instead.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loadState === "ready" && (
            <Button size="sm" variant="outline-emerald" className="gap-1.5" disabled={isSaving} onClick={handleActionClick}>
              {isSaving ? "Saving..." : footerActionLabel}
            </Button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close editor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

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
      </div>

      {isSigning && (
        <ESignatureModal
          isOpen
          onClose={() => setIsSigning(false)}
          onConfirm={handleSigned}
          actionTitle={title}
          meaningCode={signatureMeaningCode}
        />
      )}

      {staleContentWarning && (
        <FormModal
          isOpen
          title="Content changed since fields were last designed"
          description={staleContentWarning}
          confirmText="Redesign fields now"
          onClose={handleClose}
          onConfirm={() => {
            setStaleContentWarning(null);
            void init(true);
          }}
        />
      )}
    </div>
  );
};
