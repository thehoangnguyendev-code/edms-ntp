import { useCallback, useEffect, useRef, useState } from "react";
import { IconEye, IconUpload } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
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

const SCAN_TYPES = ".pdf,.png,.jpg,.jpeg,.webp";

/**
 * The results of a session typed straight into the row of each person: the maximum score of the test once at the top, the score in the row, the result worked out with the pass mark in force
 * (the server does the same sum and keeps the figures), and the scan of the paper of that person in the same row, so a scan cannot be put under another person.
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
  const eligible = (p: TrainingParticipant) => canRecord && !locked && (allLines || passPercent != null) && scoring && (p.state === "ATTENDED" || p.state === "ONLINE") && p.result !== "PASSED";
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
  const present = people.filter((p) => p.state === "ATTENDED" || p.state === "ONLINE");
  const recorded = present.filter((p) => p.result !== "PENDING").length;

  const evidenceOf = (p: TrainingParticipant) => (files?.evidence ?? []).filter((e) => e.participantId === p.id);

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
    } catch (e) {
      showToast({ type: "error", title: "The result was not recorded", message: trainingError(e) });
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

  const columns: DataTableColumn<TrainingParticipant>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_p, i) => i + 1 },
    { id: "code", header: "Employee ID", cell: (p) => p.employeeCode ?? "—" },
    {
      id: "name",
      header: "Full Name",
      cell: (p) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={p.fullName || "User"} src={p.avatar} tone="brand" className="h-8 w-8 shrink-0" />
          <span className="font-medium text-slate-900">{p.fullName}</span>
        </div>
      ),
    },
    { id: "department", header: "Department", cell: (p) => p.department ?? "—" },
    {
      id: "state",
      header: "Attendance",
      cell: (p) => <div className="max-w-56 whitespace-normal">{p.state === "ABSENT" && p.absenceReason ? `Absent: ${p.absenceReason}` : (PARTICIPANT_STATE_LABEL[p.state] ?? p.state)}</div>,
    },
    {
      id: "score",
      header: allLines ? "Checklist Result" : `Score${maxValid ? ` (of ${maxNumber})` : ""}`,
      cell: (p) => {
        if (p.result === "PASSED" || !eligible(p)) {
          return allLines ? "—" : p.lastScore != null ? `${p.lastScore} / ${p.lastMax}` : "—";
        }
        if (allLines) {
          return (
            <select
              aria-label={`Checklist result of ${p.fullName}`}
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
              aria-label={`Score of ${p.fullName}`}
              aria-invalid={bad}
              placeholder={p.lastScore != null ? `${p.lastScore} (last)` : "—"}
              value={typed(p) ?? ""}
              disabled={saving}
              onChange={(e) => setScores((s) => ({ ...s, [p.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid(p)) void saveRows([p]);
              }}
            />
            {bad && <div className="mt-0.5 text-xs text-red-700">0 to {maxValid ? maxNumber : "the maximum"}</div>}
          </div>
        );
      },
    },
    {
      id: "result",
      header: "Result",
      cell: (p) => {
        if (eligible(p) && valid(p) && allLines) {
          return <Badge color={parsed(p) === 1 ? "emerald" : "red"}>{parsed(p) === 1 ? "Pass" : "Not passed"} · not saved</Badge>;
        }
        if (eligible(p) && valid(p)) {
          const percent = Math.round(((parsed(p) as number) * 10000) / maxNumber) / 100;
          const pass = allLines ? (parsed(p) as number) >= maxNumber : percent >= (passPercent ?? 0);
          return <Badge color={pass ? "emerald" : "red"}>{pass ? "Pass" : "Not passed"} ({percent}%) · not saved</Badge>;
        }
        return (
          <Badge color={p.result === "PASSED" ? "emerald" : p.result === "FAILED" ? "red" : "slate"}>
            {p.result === "PASSED" ? "Pass" : p.result === "FAILED" ? "Not passed" : "Pending"}
            {p.lastPercent != null && !allLines ? ` (${p.lastPercent}%)` : ""}
          </Badge>
        );
      },
    },
    {
      id: "scan",
      header: "Scan",
      cell: (p) => {
        const mine = evidenceOf(p);
        return (
          <div className="flex items-center gap-2">
            {mine.length > 0 && p.personUserId && (
              <button type="button" className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline" onClick={() => setViewing(p)} aria-label={`View the scan of ${p.fullName}`}>
                <IconEye className="h-4 w-4" /> {mine.length === 1 ? "View" : `View (${mine.length})`}
              </button>
            )}
            {mine.length > 0 && !p.personUserId && <span className="text-sm text-slate-600">{mine.length} file(s)</span>}
            {files?.canUploadEvidence && (p.state === "ATTENDED" || p.state === "ONLINE") && (
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
                disabled={uploading === p.id}
                aria-label={`${mine.length ? "Add another scan for" : "Upload the scan of"} ${p.fullName}`}
                title={mine.length ? "Add another scan" : "Upload the scan of the paper of this person"}
                onClick={() => {
                  target.current = p;
                  pick.current?.click();
                }}
              >
                <IconUpload className="h-4 w-4" />
              </button>
            )}
            {mine.length === 0 && !files?.canUploadEvidence && "—"}
          </div>
        );
      },
    },
    ...(people.some((p) => p.examState === "USED" && p.result === "PENDING") && canRelease
      ? [{
          id: "release",
          header: "Action",
          cell: (p: TrainingParticipant) =>
            p.examState === "USED" && p.result === "PENDING" ? (
              <Button size="sm" variant="outline-emerald" onClick={() => onRelease(p)}>Release the Test</Button>
            ) : null,
        } as DataTableColumn<TrainingParticipant>]
      : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
        <div className="flex flex-wrap items-end gap-4">
          {!allLines && (
            <label className="block text-xs font-medium text-slate-700 sm:text-sm">
              Maximum score of the test
              <div className="mt-1 w-36">
                <Input type="number" min={1} step="any" value={max} aria-label="Maximum score of the test" onChange={(e) => setMax(e.target.value)} />
              </div>
            </label>
          )}
          <div className="pb-2 text-xs text-slate-600 sm:text-sm">
            {allLines ? "Pass: every line correct" : "Pass mark"}: {!allLines && <span className="font-semibold text-slate-900">{passPercent != null ? `${passPercent}%` : "—"}</span>} · Results:{" "}
            <span className="font-semibold text-slate-900">{recorded} / {present.length}</span>
          </div>
        </div>
        {canRecord && scoring && !locked && (
          <Button size="sm" loading={saving} disabled={ready.length === 0 || ready.length !== pending.length} onClick={() => void saveRows(ready)}>
            Save all{ready.length > 0 ? ` (${ready.length})` : ""}
          </Button>
        )}
      </div>
      {!maxValid && canRecord && scoring && !locked && <p className="text-xs text-red-700">Enter the maximum score of the test first.</p>}
      <input ref={pick} type="file" accept={SCAN_TYPES} className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      <DataTable
        rows={people}
        getRowKey={(p) => p.id}
        columns={columns}
        emptyState={<p className="p-4 text-sm text-slate-500">No participant yet.</p>}
      />
      {viewing?.personUserId && <TrainingScannedTestsModal personId={viewing.personUserId} activityId={activityId} onClose={() => setViewing(undefined)} />}
    </div>
  );
}
