import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { config } from "@/config";
import { documentApi } from "@/services/api/documents";
import { getApiErrorMessage } from "@/utils/apiError";
import { OnlyOfficeCapacityNotice } from "./OnlyOfficeCapacityNotice";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";

interface OnlyOfficeDocumentViewerProps {
  revisionId: string;
  /** Any value that changes when the stored source changes, so the viewer reloads the latest saved file. */
  versionToken?: string | null;
  height?: string;
  /** Poll the revision and reload when its source changes (default). Turn off for an immutable Effective revision. */
  watchForChanges?: boolean;
}

const CONTAINER_PREFIX = "onlyoffice-viewer-";

/**
 * Read-only OnlyOffice view of a revision's working file (Document tab in Draft / Pending Review /
 * Pending Approval): no conversion, no snapshot wait, always the latest saved content. Editing,
 * commenting, download and print are switched off by the backend config (EditMode.VIEW). The viewer
 * polls the revision and reloads itself when the stored source changes, so saves show up without a
 * manual refresh.
 */
export const OnlyOfficeDocumentViewer = ({ revisionId, versionToken, height = "calc(100vh - 260px)", watchForChanges = true }: OnlyOfficeDocumentViewerProps) => {
  const containerId = `${CONTAINER_PREFIX}${revisionId}`;
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [liveToken, setLiveToken] = useState<string | null>(versionToken ?? null);
  const [viewerConfigVersion, setViewerConfigVersion] = useState(0);
  const editorRef = useRef<{ destroyEditor?: () => void } | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  // OnlyOffice applies its customization when the editor iframe is created. A committed admin
  // configuration change is broadcast through the authenticated SSE stream, so every open
  // viewer re-requests its server-authoritative signed config without reloading the page.
  useEffect(() => subscribeNotificationRealtime((event) => {
    if (event.type === "onlyoffice-viewer-config-updated") {
      setViewerConfigVersion((current) => current + 1);
    }
  }), []);

  // Watch the stored source; a new checksum means a save landed and the view is out of date.
  useEffect(() => {
    if (!watchForChanges) {
      // Nothing to watch: open once with a fixed token (the caller may not even be allowed to read the revision record).
      setLiveToken((current) => current ?? "static");
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const live = await documentApi.getRevisionById(revisionId);
        if (cancelled || !live) return;
        const token = `${String(live.sourceFileChecksum ?? "")}|${String(live.statusCode ?? live.status ?? "")}`;
        setLiveToken((current) => (current === token ? current : token));
      } catch {
        // transient failure -- next tick retries; never leave the viewer waiting for a first token
        setLiveToken((current) => current ?? "unknown");
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [revisionId, watchForChanges]);

  useEffect(() => {
    if (liveToken === null) return; // wait for the first version token so the editor opens once
    let cancelled = false;
    let holder: HTMLDivElement | null = null;
    setState("loading");

    const loadScript = () =>
      new Promise<void>((resolve, reject) => {
        if (window.DocsAPI) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = `${config.onlyOffice.documentServerUrl}/web-apps/apps/api/documents/api.js`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Could not load the OnlyOffice viewer script."));
        document.body.appendChild(script);
      });

    const init = async () => {
      try {
        const viewConfig = await documentApi.getRevisionOnlyOfficeViewConfig(revisionId);
        await loadScript();
        if (cancelled) return;
        if (!window.DocsAPI) throw new Error("OnlyOffice viewer script did not load correctly.");
        editorRef.current?.destroyEditor?.();
        // DocsAPI REPLACES the element it is given with its own iframe. That element must therefore not
        // be one React renders (React later tries to insertBefore/remove nodes that are gone and throws
        // "NotFoundError ... not a child of this node"). Create a throw-away holder imperatively inside
        // a React-owned host that has no React children.
        const host = hostRef.current;
        if (!host) return;
        holder = document.createElement("div");
        holder.id = containerId;
        holder.style.width = "100%";
        holder.style.height = "100%";
        host.replaceChildren(holder);
        editorRef.current = new window.DocsAPI.DocEditor(containerId, {
          ...viewConfig,
          width: "100%",
          // DocsAPI only understands px or %, not calc(); the wrapper below carries the real height.
          height: "100%",
          events: {
            onError: () => {
              setMessage("The document viewer reported an error. If many people are online, the connection limit of the online service may have been reached.");
              setState("error");
            },
          },
        });
        setState("ready");
      } catch (error) {
        if (cancelled) return;
        setMessage(getApiErrorMessage(error, "Unable to open the document viewer."));
        setState("error");
      }
    };

    void init();
    return () => {
      cancelled = true;
      editorRef.current?.destroyEditor?.();
      editorRef.current = null;
      hostRef.current?.replaceChildren();
    };
    // Re-open whenever the stored source changes.
  }, [revisionId, liveToken, containerId, viewerConfigVersion]);

  return (
    <div className="space-y-2">
    <OnlyOfficeCapacityNotice kind="view" />
    <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white" style={{ height, minHeight: 420 }}>
      {state === "loading" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading document...</span>
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white px-6 text-center text-slate-600">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <span className="text-sm">{message}</span>
        </div>
      )}
      <div ref={hostRef} className="h-full w-full" />
    </div>
    </div>
  );
};
