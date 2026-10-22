import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { config } from "@/config";
import { OnlyOfficeCapacityNotice } from "@/features/documents/shared/components/OnlyOfficeCapacityNotice";
import { trainingError, trainingFilesApi, type AssessmentEditOpen } from "@/services/api/trainingActivities";

const CONTAINER_ID = "training-assessment-editor";

/**
 * The exam template or the answer key of an activity written in OnlyOffice, full screen. The server signs the editor configuration and receives each save: Save in the
 * editor puts the file in the activity as the exam template (or the answer key), so there is nothing to upload afterwards. Closing the editor returns to the activity.
 */
export function TrainingAssessmentEditorFrame({ activityId, request, onClose }: { activityId: string; request: AssessmentEditOpen; onClose: () => void }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const editor = useRef<{ destroyEditor?: () => void } | null>(null);
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Asking again is harmless: the server joins the edit session that is already open.
    let cancelled = false;
    const loadScript = () => new Promise<void>((resolve, reject) => {
      if (window.DocsAPI) { resolve(); return; }
      const script = document.createElement("script");
      script.src = `${config.onlyOffice.documentServerUrl}/web-apps/apps/api/documents/api.js`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load the editor script."));
      document.body.appendChild(script);
    });
    (async () => {
      try {
        const opened = await trainingFilesApi.openEditor(activityId, request);
        await loadScript();
        if (cancelled || !host.current || !window.DocsAPI) return;
        setTitle(opened.fileName);
        const holder = document.createElement("div");
        holder.id = CONTAINER_ID;
        holder.style.width = "100%";
        holder.style.height = "100%";
        host.current.replaceChildren(holder);
        editor.current = new window.DocsAPI.DocEditor(CONTAINER_ID, {
          ...opened.config,
          events: { onError: () => { setMessage("The editor reported an error. If many people are online, the limit of the editing service may have been reached; try again shortly."); setState("error"); } },
        });
        setState("ready");
      } catch (e) {
        if (cancelled) return;
        setMessage(trainingError(e));
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityId, request]);

  useEffect(() => () => { editor.current?.destroyEditor?.(); host.current?.replaceChildren(); }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <img src={`${config.api.baseURL}/branding/logo`} alt="" className="h-7 max-w-[200px] object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{request.purpose === "ANSWER_KEY" ? "Answer key" : "Exam template"}{title ? `: ${title}` : ""}</div>
            <div className="text-xs text-slate-500">Press Save in the editor: the file becomes the {request.purpose === "ANSWER_KEY" ? "answer key" : "exam template"} of this training.</div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900" aria-label="Close editor"><X className="h-4 w-4" /></button>
      </div>
      <OnlyOfficeCapacityNotice kind="edit" className="mx-4 mt-2" />
      <div className="relative flex-1">
        {state === "loading" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /><span className="text-sm">Opening the editor…</span></div>}
        {state === "error" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-slate-700"><AlertTriangle className="h-6 w-6 text-amber-400" /><span className="text-sm">{message}</span></div>}
        <div ref={host} className="h-full w-full" />
      </div>
    </div>
  );
}
