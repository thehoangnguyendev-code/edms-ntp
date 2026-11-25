import { useCallback, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Drawer } from "@/components/ui/drawer/Drawer";
import { TabNav } from "@/components/ui/tabs/TabNav";
import type { TrainingActivityDetail, TrainingCapabilities, TrainingParticipant } from "@/services/api/trainingActivities";
import type { ActivityMode } from "../../TrainingActivityDetailPage";
import { TrainingActivityFilesTab } from "../TrainingActivityFilesTab";
import { TrainingExamBlock } from "../TrainingExamBlock";
import { TrainingPrintedPacks } from "../TrainingPaperBlock";
import { TrainingTranscriptionBlock } from "../TrainingTranscriptionBlock";
import { tr, trFormat } from "@/i18n";

type Key = "test" | "materials" | "packs" | "typed" | "scans";
const ORDER: Key[] = ["test", "materials", "packs", "typed", "scans"];
const WAITING_FIRST: Key[] = ["typed", "packs", "scans"];
const LABEL: Record<Key, string> = { test: "Test in the system", materials: "Assessment Materials", packs: "Printed packs", typed: "Results from paper", scans: "Scans and filled files" };

/** What each block tells the step once it has loaded. A block that is not drawn tells nothing, and has no tab. */
interface Summary {
  test?: { questions: number };
  materials?: { examUploaded: boolean };
  packs?: { total: number; issued: number };
  typed?: { total: number; waiting: number };
  scans?: { total: number; unchecked: number };
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The number beside a tab, and the words about what waits in it (none when nothing does). */
function tabOf(key: Key, s: Summary): { count: number; waits?: string } | undefined {
  switch (key) {
    case "test": return s.test ? { count: s.test.questions } : undefined;
    case "materials": return s.materials ? { count: s.materials.examUploaded ? 1 : 0 } : undefined;
    case "packs": return s.packs ? { count: s.packs.total, waits: s.packs.issued > 0 ? `${s.packs.issued} still Issued` : undefined } : undefined;
    case "typed": return s.typed ? { count: s.typed.total, waits: s.typed.waiting > 0 ? `${s.typed.waiting} waiting to be checked` : undefined } : undefined;
    case "scans": return s.scans ? { count: s.scans.total, waits: s.scans.unchecked > 0 ? `${plural(s.scans.unchecked, "scan")} not yet checked` : undefined } : undefined;
  }
}

const same = (a: object | undefined, b: object | undefined) => (a === undefined || b === undefined ? a === b : JSON.stringify(a) === JSON.stringify(b));

/**
 * Step 4 of the session workspace: the test, the exam files, the paper copies, the results typed from paper, and the scans, one at a time. On a desktop they are the tabs of the step, and the tab with
 * something waiting is open first; on a phone the title of the block is the switch and opens the list of the five. The blocks keep their own work and only report to the step, and the Test never
 * shows which answer is right.
 */
export function WorkspaceAssessmentStep({ activityId, scoped, people, caps, mode, external, userId, onChanged }: {
  activityId: string;
  scoped: TrainingActivityDetail;
  people: TrainingParticipant[];
  caps?: TrainingCapabilities;
  mode: ActivityMode;
  external: boolean;
  userId?: string;
  onChanged: () => void;
}) {
  const [summary, setSummary] = useState<Summary>({});
  const [picked, setPicked] = useState<Key>();
  const [switching, setSwitching] = useState(false);
  const onTest = useCallback((questions: number | undefined) => setSummary((s) => (s.test?.questions === questions ? s : { ...s, test: questions ? { questions } : undefined })), []);
  const onPacks = useCallback((packs: { total: number; issued: number } | undefined) => setSummary((s) => (same(s.packs, packs) ? s : { ...s, packs })), []);
  const onTyped = useCallback((typed: { total: number; waiting: number } | undefined) => setSummary((s) => (same(s.typed, typed) ? s : { ...s, typed })), []);
  const onFiles = useCallback((files: Pick<Summary, "materials" | "scans">) => setSummary((s) => (same(s.materials, files.materials) && same(s.scans, files.scans) ? s : { ...s, ...files })), []);

  const tabs = ORDER.flatMap((key) => {
    const t = tabOf(key, summary);
    return t ? [{ key, ...t }] : [];
  });
  // With nothing chosen, the step opens where the person is needed: results to check first, then copies to close, then scans to check.
  const firstWaiting = WAITING_FIRST.find((key) => tabs.some((t) => t.key === key && t.waits));
  const active: Key | undefined = tabs.find((t) => t.key === picked)?.key ?? firstWaiting ?? tabs[0]?.key;
  const current = tabs.find((t) => t.key === active);
  const othersWaiting = tabs.filter((t) => t.waits && t.key !== active).length;
  const pane = (key: Key) => active !== key;

  return (
    <section aria-label={tr("Assessment")} className="space-y-4">
      {tabs.length > 0 && (
        <>
          <TabNav
            className="hidden md:block"
            ariaLabel="Assessment blocks"
            tabs={tabs.map((t) => ({ id: t.key, label: LABEL[t.key], count: t.count, dot: Boolean(t.waits), dotLabel: t.waits }))}
            activeTab={active ?? ""}
            onChange={(id) => setPicked(id as Key)}
            tabIdPrefix="ws-assess-tab"
            panelIdPrefix="ws-assess-pane"
          />
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setSwitching(true)}
            className="flex w-full items-center justify-between gap-3 border-b border-slate-200 pb-3 text-left md:hidden"
          >
            <span className="min-w-0">
              <span className="block text-base font-semibold text-slate-900">{current ? LABEL[current.key] : ""} <span className="font-normal text-slate-500">{current?.count}</span></span>
                    <span className="block text-[13px] text-slate-500">{trFormat("Section {current} of {total}", { current: Math.max(1, tabs.findIndex((t) => t.key === active) + 1), total: tabs.length })}{othersWaiting > 0 ? trFormat(" · {count} others need you", { count: othersWaiting }) : ""}</span>
            </span>
            <ChevronsUpDown className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          </button>
        </>
      )}

      <div role="tabpanel" id="ws-assess-pane-test" aria-labelledby="ws-assess-tab-test" hidden={pane("test")}>
        {!external && <TrainingExamBlock activityId={activityId} hideKey bare onSummary={onTest} />}
      </div>
      <div role="tabpanel" id="ws-assess-pane-packs" aria-labelledby="ws-assess-tab-packs" hidden={pane("packs")}>
        <TrainingPrintedPacks activity={scoped} onChanged={onChanged} bare onSummary={onPacks} />
      </div>
      <div role="tabpanel" id="ws-assess-pane-typed" aria-labelledby="ws-assess-tab-typed" hidden={pane("typed")}>
        <TrainingTranscriptionBlock activity={scoped} userId={userId} canEnter={Boolean(caps?.transcribe)} canVerify={Boolean(caps?.verifyTranscription)} onChanged={onChanged} bare onSummary={onTyped} />
      </div>
      <div role="tabpanel" id={`ws-assess-pane-${active === "materials" ? "materials" : "scans"}`} aria-labelledby={`ws-assess-tab-${active === "materials" ? "materials" : "scans"}`} hidden={active !== "materials" && active !== "scans"}>
        <TrainingActivityFilesTab key="ws-evidence" part="assessment" reader visible={active === "materials" ? "materials" : "scans"} materialsReadOnly mode={mode} external={external} activityId={activityId} participants={people} onSummary={onFiles} />
      </div>

      {switching && (
        <Drawer title={tr("Assessment")} onClose={() => setSwitching(false)} onExited={() => setSwitching(false)}>
          <ul className="-mx-4 divide-y divide-slate-100">
            {tabs.map((t, i) => (
              <li key={t.key}>
                <button
                  type="button"
                  aria-current={t.key === active ? "true" : undefined}
                  onClick={() => { setPicked(t.key); setSwitching(false); }}
                  className={`flex w-full items-center gap-3 px-5 py-3.5 text-left ${t.key === active ? "bg-slate-50" : ""}`}
                >
                  <span className="w-5 text-sm text-slate-400">{i + 1}</span>
                  <span className={`min-w-0 flex-1 text-sm text-slate-900 ${t.key === active ? "font-semibold" : "font-medium"}`}>{LABEL[t.key]}</span>
                  {t.waits ? <span className="text-sm text-amber-700">{t.waits}</span> : <span className="text-sm text-slate-400">{t.count}</span>}
                </button>
              </li>
            ))}
          </ul>
        </Drawer>
      )}
    </section>
  );
}
