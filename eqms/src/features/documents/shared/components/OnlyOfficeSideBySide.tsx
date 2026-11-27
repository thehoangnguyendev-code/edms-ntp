import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Link2, Link2Off, Loader2, RefreshCw } from "lucide-react";
import { config } from "@/config";
import { Button } from "@/components/ui/button/Button";
import { documentApi } from "@/services/api/documents";
import { getApiErrorMessage } from "@/utils/apiError";
import { OnlyOfficeCapacityNotice } from "./OnlyOfficeCapacityNotice";
import { createScrollSync, type PaneIndex } from "./scrollSync";
import { tr, trFormat } from "@/i18n";

type SideBySide = Awaited<ReturnType<typeof documentApi.getRevisionSideBySideConfig>>;
type PaneData = SideBySide["baseline"];
type Editor = { destroyEditor?: () => void };

const CHANNEL = "eqms-scroll";
const READY_TIMEOUT_MS = 90000;
const BRIDGE_TIMEOUT_MS = 15000;

const documentServerOrigin = () => new URL(config.onlyOffice.documentServerUrl, window.location.href).origin;

const loadDocsApi = () =>
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

const paneTitle = (pane: PaneData) => {
  if (pane.statusCode === "EFFECTIVE") return trFormat("Effective revision {revision}", { revision: pane.revisionNumber });
  if (pane.statusCode === "OBSOLETED") return trFormat("Obsoleted revision {revision}", { revision: pane.revisionNumber });
  return trFormat("Revision {revision} under review", { revision: pane.revisionNumber });
};

/** One read-only viewer. It reports its iframe once the document is shown, and its own failure in its own place: a failed pane is never silently left blank. */
const Pane = ({ data, onReady, onFailed }: { data: PaneData; onReady: (frame: HTMLIFrameElement) => void; onFailed: () => void }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let editor: Editor | null = null;
    const host = hostRef.current;
    const fail = () => {
      if (cancelled) return;
      setState("error");
      onFailed();
    };
    const timeout = window.setTimeout(fail, READY_TIMEOUT_MS);
    setState("loading");
    loadDocsApi()
      .then(() => {
        if (cancelled || !host || !window.DocsAPI) return;
        const holder = document.createElement("div");
        // Unique for every opening: two viewers, or a quick change of revision, can never take over each other's element.
        holder.id = `onlyoffice-side-${data.revisionId}-${Math.random().toString(36).slice(2)}`;
        holder.style.width = "100%";
        holder.style.height = "100%";
        host.replaceChildren(holder);
        editor = new window.DocsAPI.DocEditor(holder.id, {
          ...data.config,
          width: "100%",
          height: "100%",
          events: {
            onDocumentReady: () => {
              window.clearTimeout(timeout);
              const frame = host.querySelector("iframe");
              if (cancelled || !frame) return;
              setState("ready");
              onReady(frame);
            },
            onError: () => {
              window.clearTimeout(timeout);
              fail();
            },
          },
        });
      })
      .catch(fail);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      editor?.destroyEditor?.();
      host?.replaceChildren();
    };
  }, [data, onReady, onFailed]);

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label={paneTitle(data)}>
      <header className="border-b border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-900">{paneTitle(data)}</header>
      <div className="relative min-h-0 flex-1">
        {state === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            {tr("Loading document...")}
          </div>
        )}
        {state === "error" && (
          <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white px-6 text-center text-sm text-slate-700">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            {tr("This document could not be shown. Do not compare with the other one alone: close the comparison and open it again.")}
          </div>
        )}
        <div ref={hostRef} className="h-full w-full" />
      </div>
    </section>
  );
};

/**
 * The chosen revision and the revision under review next to each other, both read only, scrolling together. The server says which revision each side shows and the labels
 * come from its answer; an answer about other revisions than the ones asked for is not displayed.
 */
export const OnlyOfficeSideBySide = ({ revisionId, baselineId }: { revisionId: string; baselineId: string }) => {
  const [data, setData] = useState<SideBySide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sync, setSync] = useState<"waiting" | "on" | "off" | "unavailable">("waiting");
  const [stale, setStale] = useState(false);
  const framesRef = useRef<(HTMLIFrameElement | null)[]>([null, null]);
  const readyRef = useRef([false, false]);
  const [frameCount, setFrameCount] = useState(0);
  const syncRef = useRef<ReturnType<typeof createScrollSync> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setStale(false);
    setSync("waiting");
    setFrameCount(0);
    framesRef.current = [null, null];
    readyRef.current = [false, false];
    syncRef.current = createScrollSync((pane, y) => {
      framesRef.current[pane]?.contentWindow?.postMessage({ channel: CHANNEL, kind: "scrollTo", y }, documentServerOrigin());
    });
    documentApi
      .getRevisionSideBySideConfig(revisionId, baselineId)
      .then((answer) => {
        if (cancelled) return;
        if (answer.current.revisionId !== revisionId || answer.baseline.revisionId !== baselineId) {
          setError(tr("The server answered about other revisions than the ones chosen. Close the comparison and open it again."));
          return;
        }
        setData(answer);
      })
      .catch((failure) => {
        if (!cancelled) setError(getApiErrorMessage(failure, "Unable to open the comparison."));
      });
    return () => {
      cancelled = true;
    };
  }, [revisionId, baselineId, attempt]);

  const setFrame = useCallback((pane: PaneIndex, frame: HTMLIFrameElement) => {
    framesRef.current[pane] = frame;
    setFrameCount(framesRef.current.filter(Boolean).length);
  }, []);
  const readyLeft = useCallback((frame: HTMLIFrameElement) => setFrame(0, frame), [setFrame]);
  const readyRight = useCallback((frame: HTMLIFrameElement) => setFrame(1, frame), [setFrame]);
  const failed = useCallback(() => setSync("unavailable"), []);

  // Messages of the bridge: accepted only from the two viewers of this screen, on the Document Server's origin.
  useEffect(() => {
    const origin = documentServerOrigin();
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || !event.data || event.data.channel !== CHANNEL) return;
      const index = framesRef.current.findIndex((frame) => frame?.contentWindow && frame.contentWindow === event.source);
      if (index < 0 || typeof event.data.y !== "number" || typeof event.data.max !== "number") return;
      const pane = index as PaneIndex;
      const position = { y: event.data.y, max: event.data.max };
      if (event.data.kind === "ready" && !readyRef.current[pane]) {
        readyRef.current[pane] = true;
        syncRef.current?.start(pane, position);
        if (readyRef.current.every(Boolean)) setSync((current) => (current === "waiting" ? "on" : current));
      } else if (event.data.kind === "position") {
        syncRef.current?.report(pane, position);
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  // Once both documents are shown, ask each bridge to start; give up with a clear notice if it never answers.
  useEffect(() => {
    if (frameCount < 2) return;
    const attach = () =>
      framesRef.current.forEach((frame, index) => {
        if (!readyRef.current[index]) frame?.contentWindow?.postMessage({ channel: CHANNEL, kind: "attach" }, documentServerOrigin());
      });
    attach();
    const again = window.setInterval(attach, 700);
    const giveUp = window.setTimeout(() => {
      window.clearInterval(again);
      setSync((current) => (current === "waiting" ? "unavailable" : current));
    }, BRIDGE_TIMEOUT_MS);
    return () => {
      window.clearInterval(again);
      window.clearTimeout(giveUp);
    };
  }, [frameCount]);

  // The file under review may be saved again while it is being compared: say so rather than leave an old copy looking current.
  const shownChecksum = data?.current.sourceChecksum;
  useEffect(() => {
    if (!shownChecksum) return;
    const timer = window.setInterval(() => {
      documentApi
        .getRevisionById(revisionId)
        .then((live) => {
          if (live?.sourceFileChecksum && live.sourceFileChecksum !== shownChecksum) setStale(true);
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [revisionId, shownChecksum]);

  const toggle = () => {
    const next = sync === "on" ? "off" : "on";
    syncRef.current?.setEnabled(next === "on");
    setSync(next);
  };

  if (error) {
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-slate-700">
        <AlertTriangle className="h-6 w-6 text-amber-500" />
        {error}
        <Button type="button" size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>{tr("Try again")}</Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        {tr("Loading document...")}
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <OnlyOfficeCapacityNotice kind="view" />
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-600">{tr("Left: the chosen revision as published. Right: the file under review as last saved, with its changes marked.")}</p>
        {sync === "unavailable" ? (
          <span role="status" className="text-xs font-medium text-amber-700 sm:max-w-xs">{tr("Synchronised scrolling is unavailable: scroll each side separately.")}</span>
        ) : (
          <Button type="button" size="sm" variant={sync === "on" ? "outline-emerald" : "outline"} className="h-11 shrink-0 gap-2 whitespace-nowrap sm:h-9" disabled={sync === "waiting"} aria-pressed={sync === "on"} onClick={toggle}>
            {sync === "off" ? <Link2Off className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {sync === "off" ? tr("Scroll separately") : tr("Scroll together")}
          </Button>
        )}
      </div>
      {stale && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {tr("The file under review was saved again. The right side shows the earlier save.")}
          <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => setAttempt((value) => value + 1)}>
            <RefreshCw className="h-4 w-4" />
            {tr("Reload comparison")}
          </Button>
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        <Pane data={data.baseline} onReady={readyLeft} onFailed={failed} />
        <Pane data={data.current} onReady={readyRight} onFailed={failed} />
      </div>
    </div>
  );
};
