import { useCallback, useEffect, useRef, useState } from "react";
import { IconChevronRight, IconEye, IconUpload } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeColor } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Drawer } from "@/components/ui/drawer/Drawer";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { useToast } from "@/components/ui/toast/Toast";
import {
  trainingActivitiesApi,
  trainingError,
  trainingFilesApi,
  type TrainingActivityDetail,
  type TrainingActivityFiles,
  type TrainingParticipant,
} from "@/services/api/trainingActivities";
import { Input } from "../../../shared/TrainingFields";
import { TrainingScannedTestsModal } from "../../../shared/TrainingScannedTestsModal";
import { PARTICIPANT_STATE_LABEL } from "../../../shared/trainingLabels";
import { RowActionsMenu } from "./RowActionsMenu";

const SCAN_TYPES = ".pdf";

/** Fixed widths so the three groups, each its own table, line up under one set of headers. */
const W = { no: "w-14", score: "w-44", result: "w-64", scan: "w-32" };

type GroupKey = "score" | "recorded" | "absent";
const GROUP_DOT: Record<GroupKey, string> = { score: "bg-amber-400", recorded: "bg-emerald-500", absent: "bg-slate-300" };
const GROUP_TITLE: Record<GroupKey, string> = { score: "To score", recorded: "Recorded", absent: "Absent" };

/**
 * The results of a session. Desktop: one table per group of people (To score, Recorded, Absent), the score typed in the row. Phone: a light list, and a tap on a person opens a sheet to score that person.
 * The maximum score of the test is set once at the top, the result is worked out with the pass mark in force (the server does the same sum and keeps the figures), and the scan of the paper of a person
 * is in the row of that person, so a scan cannot be put under another person.
 * Nothing is saved by leaving a field: Enter saves the row, "Save all" saves every row with a new score, and every save is in the Audit Trail.
 */
export function WorkspaceResultsTable({ activityId, people, passPercent, defaultMax, locked, canRecord, canRelease, onRelease, assessmentMethod, onActivity }: {
  activityId: string;
  people: TrainingParticipant[];
  /** The pass mark of Training Properties, as the server sends it; nothing is shown as a result without it. */
  passPercent?: number;
  /** The total score of the assessment of the library the activity uses: it fills the maximum score, which the trainer can still change. */
  defaultMax?: number;
  /** The trainer has finished the training: the results are written in the list and are not changed. */
  locked: boolean;
  canRecord: boolean;
  /** The trainer may release a spent online test for another try. */
  canRelease: boolean;
  onRelease: (p: TrainingParticipant) => void;
  assessmentMethod?: string | null;
  onActivity: (activity: TrainingActivityDetail) => void;
}) {
  const { showToast } = useToast();
  const [max, setMax] = useState(() => { const saved = people.find((p) => p.lastMax != null)?.lastMax; return saved != null ? String(saved) : defaultMax != null ? String(defaultMax) : ""; });
  const [scores, setScores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<TrainingActivityFiles>();
  const [uploading, setUploading] = useState<string>();
  const [viewing, setViewing] = useState<TrainingParticipant>();
  const [sheetId, setSheetId] = useState<string>();
  const pick = useRef<HTMLInputElement>(null);
  const target = useRef<TrainingParticipant | undefined>(undefined);

  const loadFiles = useCallback(() => {
    trainingFilesApi.list(activityId).then(setFiles).catch(() => setFiles(undefined));
  }, [activityId]);
  useEffect(loadFiles, [loadFiles]);

  const scoring = !!assessmentMethod && assessmentMethod !== "SELF_READING_CONFIRMATION";
  // A checklist has no score (APD.0009 case 2): it is passed only when every line is as the key says, so the trainer picks Pass or Not passed (sent as 1 of 1 or 0 of 1).
  // A test is scored, and passed with the pass mark of Training Properties.
  const allLines = assessmentMethod === "CHECKLIST";
  const maxNumber = allLines ? 1 : Number(max);
  const maxValid = allLines || (max.trim() !== "" && Number.isFinite(maxNumber) && maxNumber > 0);
  const isPresent = (p: TrainingParticipant) => p.state === "ATTENDED" || p.state === "ONLINE";
  const eligible = (p: TrainingParticipant) => canRecord && !locked && (allLines || passPercent != null) && scoring && isPresent(p) && p.result !== "PASSED";
  const typed = (p: TrainingParticipant) => scores[p.id];
  const parsed = (p: TrainingParticipant) => {
    const raw = typed(p);
    if (raw === undefined || raw.trim() === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };
  const valid = (p: TrainingParticipant) => {
    const n = parsed(p);
    return n !== undefined && !Number.isNaN(n) && maxValid && n >= 0 && n <= maxNumber;
  };
  const pending = people.filter((p) => eligible(p) && parsed(p) !== undefined);
  const ready = pending.filter(valid);
  const present = people.filter(isPresent);
  const recorded = present.filter((p) => p.result !== "PENDING").length;

  const groups: { key: GroupKey; rows: TrainingParticipant[] }[] = [
    { key: "score" as const, rows: people.filter((p) => isPresent(p) && p.result === "PENDING") },
    { key: "recorded" as const, rows: people.filter((p) => isPresent(p) && p.result !== "PENDING") },
    { key: "absent" as const, rows: people.filter((p) => !isPresent(p)) },
  ].filter((g) => g.rows.length > 0);

  const evidenceOf = (p: TrainingParticipant) => (files?.evidence ?? []).filter((e) => e.participantId === p.id);
  const canReleaseRow = (p: TrainingParticipant) => canRelease && p.examState === "USED" && p.result === "PENDING";

  const saveRows = async (rows: TrainingParticipant[]) => {
    setSaving(true);
    try {
      for (const p of rows) {
        const got = parsed(p) as number;
        onActivity(await trainingActivitiesApi.assessment(p.id, got, maxNumber));
        setScores((s) => {
          const next = { ...s };
          delete next[p.id];
          return next;
        });
      }
      showToast({ type: "success", title: rows.length === 1 ? "Result recorded" : "Results recorded", message: rows.length === 1 ? rows[0].fullName : `${rows.length} results` });
      return true;
    } catch (e) {
      showToast({ type: "error", title: "The result was not recorded", message: trainingError(e) });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File | undefined) => {
    const p = target.current;
    if (!file || !p) return;
    setUploading(p.id);
    try {
      setFiles(await trainingFilesApi.uploadEvidence(activityId, file, "ASSESSMENT", p.id));
      showToast({ type: "success", title: "Scan added", message: p.fullName });
    } catch (e) {
      showToast({ type: "error", title: "The file was not uploaded", message: trainingError(e) });
    } finally {
      setUploading(undefined);
      if (pick.current) pick.current.value = "";
    }
  };
  const askScan = (p: TrainingParticipant) => {
    target.current = p;
    pick.current?.click();
  };

  /** What a typed, not yet saved score comes to, with the pass mark in force. */
  const draft = (p: TrainingParticipant) => {
    if (!(eligible(p) && valid(p))) return undefined;
    const got = parsed(p) as number;
    if (allLines) return { pass: got === 1, label: `${got === 1 ? "Pass" : "Not passed"} · not saved`, short: got === 1 ? "Pass" : "Not passed" };
    const percent = Math.round((got * 10000) / maxNumber) / 100;
    const pass = percent >= (passPercent ?? 0);
    return { pass, label: `${pass ? "Pass" : "Not passed"} (${percent}%) · not saved`, short: `${got}/${maxNumber}` };
  };

  const scoreInput = (p: TrainingParticipant, extra?: { onEnter?: () => void; autoFocus?: boolean; label?: string }) => {
    if (allLines) {
      return (
        <select
          aria-label={extra?.label ?? `Checklist result of ${p.fullName}`}
          className="h-9 w-36 rounded-lg border border-slate-200 bg-white px-2 text-sm"
          value={typed(p) ?? ""}
          disabled={saving}
          onChange={(e) => setScores((s) => ({ ...s, [p.id]: e.target.value }))}
        >
          <option value="">—</option>
          <option value="1">Pass</option>
          <option value="0">Not passed</option>
        </select>
      );
    }
    const bad = parsed(p) !== undefined && !valid(p);
    return (
      <div className="w-28">
        <Input
          type="number"
          min={0}
          max={maxValid ? maxNumber : undefined}
          step="any"
          aria-label={extra?.label ?? `Score of ${p.fullName}`}
          aria-invalid={bad}
          placeholder={p.lastScore != null ? `${p.lastScore} (last)` : "—"}
          value={typed(p) ?? ""}
          disabled={saving}
          autoFocus={extra?.autoFocus}
          onChange={(e) => setScores((s) => ({ ...s, [p.id]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid(p)) extra?.onEnter ? extra.onEnter() : void saveRows([p]);
          }}
        />
        {bad && <div className="mt-0.5 text-xs text-red-700">0 to {maxValid ? maxNumber : "the maximum"}</div>}
      </div>
    );
  };

  const resultBadge = (p: TrainingParticipant) => {
    const d = draft(p);
    if (d) return <Badge color={d.pass ? "emerald" : "red"}>{d.label}</Badge>;
    return (
      <Badge color={p.result === "PASSED" ? "emerald" : p.result === "FAILED" ? "red" : "amber"}>
        {p.result === "PASSED" ? "Pass" : p.result === "FAILED" ? "Not passed" : "Pending"}
        {p.lastPercent != null && !allLines ? ` (${p.lastPercent}%)` : ""}
      </Badge>
    );
  };

  const scanCell = (p: TrainingParticipant) => {
    const mine = evidenceOf(p);
    return (
      <div className="flex items-center gap-2">
        {mine.length > 0 && p.personUserId && (
          <button type="button" className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline" onClick={() => setViewing(p)} aria-label={`View the scan of ${p.fullName}`}>
            <IconEye className="h-4 w-4" /> {mine.length === 1 ? "View" : `View (${mine.length})`}
          </button>
        )}
        {mine.length > 0 && !p.personUserId && <span className="text-sm text-slate-600">{mine.length} file(s)</span>}
        {files?.canUploadEvidence && isPresent(p) && (
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
            disabled={uploading === p.id}
            aria-label={`${mine.length ? "Add another scan for" : "Upload the scan of"} ${p.fullName}`}
            title={mine.length ? "Add another scan" : "Upload the scan of the paper of this person"}
            onClick={() => askScan(p)}
          >
            <IconUpload className="h-4 w-4" />
          </button>
        )}
        {mine.length === 0 && !files?.canUploadEvidence && "—"}
      </div>
    );
  };

  const columns: DataTableColumn<TrainingParticipant>[] = [
    { id: "rowNo", header: "No.", locked: true, headerClassName: W.no, cellClassName: W.no, cell: (p) => people.indexOf(p) + 1 },
    {
      id: "name",
      header: "Full Name",
      cell: (p) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={p.fullName || "User"} src={p.avatar} tone="brand" className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-slate-900">{p.fullName}</div>
            <div className="text-xs text-slate-500">{[p.employeeCode, p.department].filter(Boolean).join(" · ") || "—"}</div>
          </div>
        </div>
      ),
    },
    {
      id: "score",
      header: allLines ? "Checklist Result" : `Score${maxValid ? ` (of ${maxNumber})` : ""}`,
      headerClassName: W.score,
      cellClassName: W.score,
      cell: (p) => {
        if (p.result === "PASSED" || !eligible(p)) {
          return allLines || !isPresent(p) ? "—" : p.lastScore != null ? `${p.lastScore} / ${p.lastMax}` : "—";
        }
        return scoreInput(p);
      },
    },
    {
      id: "result",
      header: "Result",
      headerClassName: W.result,
      cellClassName: W.result,
      cell: (p) => (!isPresent(p)
        ? <div className="max-w-56 whitespace-normal text-slate-600">{p.state === "ABSENT" && p.absenceReason ? `Absent: ${p.absenceReason}` : (PARTICIPANT_STATE_LABEL[p.state] ?? p.state)}</div>
        : resultBadge(p)),
    },
    { id: "scan", header: "Scan", headerClassName: W.scan, cellClassName: W.scan, cell: scanCell },
  ];
  const showMenu = people.some(canReleaseRow);

  /** Phone: the small mark on the right of a person. */
  const chipOf = (p: TrainingParticipant): { color: BadgeColor; text: string } => {
    const d = draft(p);
    if (d) return { color: d.pass ? "emerald" : "red", text: d.short };
    if (!isPresent(p)) return { color: "slate", text: "Absent" };
    if (p.result === "PENDING") return { color: "amber", text: eligible(p) ? (allLines ? "Pick result" : "Enter score") : "Pending" };
    const text = allLines ? (p.result === "PASSED" ? "Pass" : "Not passed") : p.lastScore != null ? `${p.lastScore}/${p.lastMax}` : p.result === "PASSED" ? "Pass" : "Not passed";
    return { color: p.result === "PASSED" ? "emerald" : "red", text };
  };

  const sheetPerson = people.find((p) => p.id === sheetId);
  const nextToScore = (p: TrainingParticipant) => {
    const queue = groups.find((g) => g.key === "score")?.rows.filter(eligible) ?? [];
    const at = queue.findIndex((x) => x.id === p.id);
    return queue.slice(at + 1).find((x) => parsed(x) === undefined);
  };
  const saveAndNext = async (p: TrainingParticipant) => {
    const next = nextToScore(p);
    if (await saveRows([p])) setSheetId(next?.id);
  };

  const canSave = canRecord && scoring && !locked;

  return (
    <div className="relative flex flex-col gap-4">
      <div className={`order-1 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 ${canSave ? "md:pr-40" : ""}`}>
        {!allLines && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Out of
            <span className="w-20">
              <Input type="number" min={1} step="any" value={max} aria-label="Maximum score of the test" title="Maximum score of the test" onChange={(e) => setMax(e.target.value)} />
            </span>
          </label>
        )}
        <div className="text-xs text-slate-600 sm:text-sm">
          {allLines ? "Pass: every line correct" : "Pass mark"}: {!allLines && <span className="font-semibold text-slate-900">{passPercent != null ? `${passPercent}%` : "—"}</span>} · Results:{" "}
          <span className="font-semibold text-slate-900">{recorded} / {present.length}</span>
        </div>
      </div>
      {!maxValid && canSave && <p className="order-1 -mt-2 text-xs text-red-700">Enter the maximum score of the test first.</p>}
      <input ref={pick} type="file" accept={SCAN_TYPES} className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />

      <div className="order-2 flex flex-col gap-4">
        {people.length === 0 && <p className="p-4 text-sm text-slate-500">No participant yet.</p>}
        {groups.map((g, gi) => (
          <section key={g.key} aria-label={GROUP_TITLE[g.key]}>
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span className={`h-2 w-2 rounded-full ${GROUP_DOT[g.key]}`} aria-hidden />
              {GROUP_TITLE[g.key]}
              <span className="font-normal text-slate-400">{g.rows.length}</span>
            </h4>
            <div className="hidden md:block">
              <DataTable
                rows={g.rows}
                getRowKey={(p) => p.id}
                columns={columns}
                tableClassName={`table-fixed${gi > 0 ? " [&_thead]:hidden" : ""}`}
                action={showMenu ? {
                  header: "",
                  headerClassName: "w-14",
                  cellClassName: "w-14",
                  cell: (p) => <RowActionsMenu id={`results-${p.id}`} label={`Actions for ${p.fullName}`} actions={canReleaseRow(p) ? [{ key: "release", label: "Release the Test", run: () => onRelease(p) }] : []} />,
                } : undefined}
              />
            </div>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white md:hidden">
              {g.rows.map((p) => {
                const chip = chipOf(p);
                return (
                  <li key={p.id}>
                    <button type="button" aria-label={`Open ${p.fullName}`} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setSheetId(p.id)}>
                      <Avatar name={p.fullName || "User"} src={p.avatar} tone="brand" className="h-10 w-10 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 break-words text-sm font-medium leading-snug text-slate-900">{p.fullName}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{[p.employeeCode, p.department].filter(Boolean).join(" · ") || "—"}</span>
                      </span>
                      <Badge color={chip.color}>{chip.text}</Badge>
                      <IconChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {canSave && (
        <div className="sticky bottom-3 z-10 order-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:absolute md:right-0 md:top-0 md:bottom-auto md:rounded-none md:border-0 md:bg-transparent md:p-2.5 md:shadow-none md:backdrop-blur-none">
          <span className="text-sm text-slate-600 md:hidden"><b className="font-semibold text-slate-900">{ready.length}</b> to save</span>
          <Button size="sm" loading={saving} disabled={ready.length === 0 || ready.length !== pending.length} onClick={() => void saveRows(ready)}>
            Save all{ready.length > 0 ? ` (${ready.length})` : ""}
          </Button>
        </div>
      )}

      {sheetPerson && (
        <Drawer
          title={sheetPerson.fullName}
          subtitle={[sheetPerson.employeeCode, sheetPerson.department].filter(Boolean).join(" · ") || undefined}
          subtitlePlacement="below"
          onClose={() => setSheetId(undefined)}
          footer={(
            <div className="grid w-full gap-2.5">
              {eligible(sheetPerson) && (
                <Button loading={saving} disabled={!valid(sheetPerson)} onClick={() => void saveAndNext(sheetPerson)}>Save and next</Button>
              )}
              {files?.canUploadEvidence && isPresent(sheetPerson) && (
                <Button variant="outline-emerald" disabled={uploading === sheetPerson.id} onClick={() => askScan(sheetPerson)}>
                  <IconUpload className="h-4 w-4" /> {evidenceOf(sheetPerson).length ? "Add another scan" : "Upload the scan"}
                </Button>
              )}
              {evidenceOf(sheetPerson).length > 0 && sheetPerson.personUserId && (
                <Button variant="outline" onClick={() => { setViewing(sheetPerson); setSheetId(undefined); }}>
                  <IconEye className="h-4 w-4" /> View the scan
                </Button>
              )}
              {canReleaseRow(sheetPerson) && <Button variant="ghost" onClick={() => { onRelease(sheetPerson); setSheetId(undefined); }}>Release the Test</Button>}
            </div>
          )}
        >
          <div className="space-y-4">
            {!isPresent(sheetPerson) ? (
              <p className="text-sm text-slate-600">{sheetPerson.state === "ABSENT" && sheetPerson.absenceReason ? `Absent: ${sheetPerson.absenceReason}` : (PARTICIPANT_STATE_LABEL[sheetPerson.state] ?? sheetPerson.state)}</p>
            ) : eligible(sheetPerson) ? (
              <>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">{allLines ? "Checklist result" : "Score"}</div>
                  <div className="flex items-center gap-3 [&>div]:w-40 [&_input]:h-14 [&_input]:text-2xl [&_input]:font-semibold">
                    {scoreInput(sheetPerson, { onEnter: () => void saveAndNext(sheetPerson), autoFocus: true, label: allLines ? "Checklist result" : "Score" })}
                    {!allLines && maxValid && <span className="text-base text-slate-500">of {maxNumber}</span>}
                  </div>
                  {!maxValid && !allLines && <p className="mt-2 text-xs text-red-700">Enter the maximum score of the test first.</p>}
                </div>
                <div className="text-sm">{resultBadge(sheetPerson)}</div>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-slate-900">{allLines ? "—" : sheetPerson.lastScore != null ? `${sheetPerson.lastScore} / ${sheetPerson.lastMax}` : "—"}</p>
                <div className="text-sm">{resultBadge(sheetPerson)}</div>
              </>
            )}
          </div>
        </Drawer>
      )}
      {viewing?.personUserId && <TrainingScannedTestsModal personId={viewing.personUserId} activityId={activityId} onClose={() => setViewing(undefined)} />}
    </div>
  );
}
