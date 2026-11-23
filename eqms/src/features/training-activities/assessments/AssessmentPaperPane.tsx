import { useEffect, useRef, useState } from "react";
import { IconFileText } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { tr } from "@/i18n";

type Paper = "test" | "key";

const TABS: TabItem[] = [
  { id: "test", label: tr("Test Paper") },
  { id: "key", label: tr("Answer Key") },
];

/** The paper is made again this long after the last change of the editor (each paper is a conversion by the document server, so not at every key). */
const AUTO_DELAY_MS = 1200;
/** The first paper is made almost at once. */
const FIRST_DELAY_MS = 200;

/**
 * The paper of the assessment beside its questions: the real PDF the document server draws from what is in the editor (saved or not), in the project PDF viewer, never a drawing of ours.
 * It follows the editor: a moment after the last change the paper on show is made again (the old one stays in view until the new one is ready), as long as the assessment is complete (the server
 * refuses to draw it otherwise). The person can switch that off and update by hand. `revision` counts the changes of the editor. Nothing is stored; the papers made here are released when the pane is gone.
 */
export function AssessmentPaperPane({ make, ready, blockedReason, revision, height = "calc(100dvh - 12rem)" }: {
  /** Makes a paper and gives the address of its PDF. */
  make: (paper: Paper) => Promise<string>;
  /** False while the assessment is not complete: the server refuses to draw it. */
  ready: boolean;
  /** Why a paper cannot be made now. */
  blockedReason?: string;
  /** Goes up every time the editor changes; a paper made at another number is out of date. */
  revision: number;
  height?: string;
}) {
  const [view, setView] = useState<Paper>("test");
  const [auto, setAuto] = useState(true);
  const [made, setMade] = useState<Partial<Record<Paper, { url: string; revision: number }>>>({});
  const [loading, setLoading] = useState(false);
  // the paper and the revision that the server refused or failed: the automatic update does not try them again by itself (that would be a loop), the person's button does
  const [failed, setFailed] = useState("");
  const urls = useRef<string[]>([]);
  const latest = useRef({ make, revision });
  latest.current = { make, revision };

  // Released when the pane is really gone: React may run a cleanup and the effect again at once (development), and a paper released then would not load.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => { if (!mounted.current) urls.current.forEach((u) => URL.revokeObjectURL(u)); }, 0);
    };
  }, []);

  const generate = async () => {
    const paper = view;
    const { make: makePaper, revision: at } = latest.current;
    setLoading(true);
    setFailed("");
    try {
      const url = await makePaper(paper);
      urls.current.push(url);
      setMade((previous) => ({ ...previous, [paper]: { url, revision: at } }));
    } catch {
      setFailed(`${paper}:${at}`);
    } finally {
      setLoading(false);
    }
  };

  const current = made[view];
  const stale = current !== undefined && current.revision !== revision;
  const failedNow = failed === `${view}:${revision}`;

  useEffect(() => {
    if (!auto || !ready || loading || failedNow) return;
    if (current && current.revision === revision) return;
    const timer = setTimeout(() => void generate(), current ? AUTO_DELAY_MS : FIRST_DELAY_MS);
    return () => clearTimeout(timer);
    // `generate` reads the latest props through a ref: what restarts the wait is a change of the editor, of the paper on show, or the end of a conversion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, ready, loading, failedNow, revision, view, current]);

  const status = loading
    ? "Updating the paper…"
    : failedNow
      ? "The paper could not be made. Try again."
      : !current
        ? ""
        : !stale
          ? "The paper shows your latest changes."
          : !ready
            ? "The paper is out of date. Complete every question to update it."
            : auto
              ? "Changes not shown yet."
              : "The paper does not show your latest changes.";
  const box = { height, minHeight: "420px" };
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <TabNav tabs={TABS} activeTab={view} onChange={(id) => setView(id as Paper)} layoutId="training-assessment-pane-tab" variant="simple-underline" />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5 md:px-4">
        <p role="status" className={`min-w-0 text-xs ${failedNow ? "text-red-700" : stale && !loading ? "text-amber-700" : "text-slate-500"}`}>{status ? tr(status) : ""}</p>
        <div className="flex flex-wrap items-center gap-3">
          {(failedNow || (!auto && stale)) && (
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" loading={loading} disabled={!ready} title={ready ? undefined : blockedReason} onClick={() => void generate()}>
              {tr("Update preview")}
            </Button>
          )}
          <Checkbox checked={auto} onChange={setAuto} label={tr("Update automatically")} />
        </div>
      </div>
      {current ? (
        <div className="border-t border-slate-200" style={box}>
          <DocumentPdfViewer key={current.url} fileUrl={current.url} withFrame={false} forceHideDownloadAndPrint allowContextMenu={false} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 border-t border-slate-200 bg-slate-50 px-6 text-center" style={box}>
          {loading ? (
            <SectionLoading text="Making the paper…" />
          ) : (
            <>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200"><IconFileText className="h-5 w-5" /></span>
              <p className="max-w-xs text-sm text-slate-600">
                {view === "key"
                  ? tr("The paper with the answer key, for the trainer only. It is never handed out.")
                  : tr("The test paper as the trainee gets it, drawn by the document server from what is in the editor. Nothing is stored.")}
              </p>
              {!ready && blockedReason && <p className="max-w-xs text-xs text-slate-500">{blockedReason}</p>}
              {(!auto || failedNow) && (
                <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" disabled={!ready} title={ready ? undefined : blockedReason} onClick={() => void generate()}>
                  {tr("Make the preview")}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
