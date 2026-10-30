import { sessionStarted } from "@/services/api/trainingActivities";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { trainingError, type TrainingTranscriptionLine, trainingFilesApi, trainingTranscriptionApi, type TrainingActivityDetail, type TrainingPaperEvidence, type TrainingSession, type TrainingTranscription } from "@/services/api/trainingActivities";
import { Input, Textarea } from "../../shared/TrainingFields";
import { TabBlock } from "../../shared/TrainingDetailLayout";
import { day, statusChange } from "../../shared/trainingLabels";

const lineColumns: DataTableColumn<TrainingTranscriptionLine>[] = [
  { id: "n", header: "No.", cell: (_l, i) => i + 1 },
  { id: "name", header: "Full name", cell: (l) => l.fullName },
  { id: "state", header: "Attendance", cell: (l) => (l.state === "ATTENDED" ? "Attended" : "Absent") },
  { id: "score", header: "Score", cell: (l) => (l.scoreObtained != null ? `${l.scoreObtained} / ${l.scoreMax}` : "—") },
  { id: "why", header: "Reason / remarks", cell: (l) => <div className="max-w-64 whitespace-normal">{l.absenceReason ?? l.remarks ?? "—"}</div> },
];

const STATUS_LABEL = { ENTERED: "Waiting to be checked", VERIFIED: "Verified", REJECTED: "Rejected" } as const;
const STATUS_COLOR = { ENTERED: "amber", VERIFIED: "emerald", REJECTED: "red" } as const;

type Row = { state: string; got: string; max: string; reason: string };

/**
 * Results written on paper, typed into the system (PLAN-TR-001 17.7). One person types the lines with the scan attached; a different person checks them against
 * the scan and signs. Only then are the lines applied as attendance and assessment. The server decides who may do which and whether a line is acceptable.
 */
export function TrainingTranscriptionBlock({ activity, userId, canEnter, canVerify, onChanged }: { activity: TrainingActivityDetail; userId?: string; canEnter: boolean; canVerify: boolean; onChanged: () => void }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<TrainingTranscription[]>([]);
  const [pendingSessions, setPendingSessions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [queryState, setQueryState] = useState<"loading" | "ready" | "error">("loading");
  const generation = useRef(0);
  const [evidence, setEvidence] = useState<TrainingPaperEvidence[]>([]);
  const [entering, setEntering] = useState<TrainingSession>();
  const [viewing, setViewing] = useState<TrainingTranscription>();
  const [rejecting, setRejecting] = useState<TrainingTranscription>();
  const [signing, setSigning] = useState<TrainingTranscription>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const request = ++generation.current;
    setQueryState("loading");
    trainingTranscriptionApi.listPage(activity.id, page, limit).then((result) => {
      if (request !== generation.current) return;
      setItems(result.data); setPendingSessions(result.pendingSessionIds); setTotal(result.pagination.total);
      setQueryState("ready");
      const nextPages = Math.max(1, result.pagination.totalPages); setPages(nextPages);
      if (page > nextPages) setPage(nextPages);
    }).catch(() => { if (request === generation.current) { setItems([]); setPendingSessions([]); setTotal(0); setQueryState("error"); } });
    if (canEnter) trainingFilesApi.list(activity.id).then((f) => setEvidence(f.evidence.filter((e) => e.kind === "ATTENDANCE_SHEET" || e.kind === "ASSESSMENT"))).catch(() => setEvidence([]));
  }, [activity.id, canEnter, page, limit]);
  useEffect(() => { load(); return () => { generation.current++; }; }, [load]);
  useEntityChanged(["TRAINING"], load);

  const fail = (e: unknown) => showToast({ type: "error", title: "The action was not done", message: trainingError(e) });
  const done = (title: string) => { showToast({ type: "success", title, message: activity.trainingNumber }); load(); onChanged(); };

  const sessions = activity.sessions.filter((s) => sessionStarted(s) && (s.deliveryMode ?? "ELECTRONIC") !== "ELECTRONIC");
  const waiting = (sessionId: string) => pendingSessions.includes(sessionId);
  const open = (sessionId: string) => activity.participants.filter((p) => p.sessionId === sessionId && p.state === "INVITED");

  const columns: DataTableColumn<TrainingTranscription>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_t, i) => (page - 1) * limit + i + 1 },
    { id: "session", header: "Session", cell: (t) => `S${t.sessionNo}` },
    { id: "status", header: "Status", cell: (t) => <Badge color={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge> },
    { id: "lines", header: "Lines", cell: (t) => t.lines.length },
    { id: "scan", header: "Scan", cell: (t) => <div className="max-w-48 truncate" title={t.evidenceName}>{t.evidenceName}</div> },
    { id: "by", header: "Typed by", cell: (t) => <div><div>{t.enteredByName}</div><div className="text-xs text-slate-500">{day(t.enteredAt)}</div></div> },
    { id: "checked", header: "Checked by", cell: (t) => (t.verifiedByName ? <div><div>{t.verifiedByName}</div><div className="text-xs text-slate-500">{day(t.verifiedAt)}</div></div> : "—") },
    { id: "note", header: "Note", cell: (t) => <div className="max-w-64 whitespace-normal text-xs text-slate-600">{t.rejectReason ?? t.lateReason ?? "—"}</div> },
    {
      id: "actions",
      header: "Action",
      cell: (t) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setViewing(t)}>Lines</Button>
          {t.status === "ENTERED" && canVerify && t.enteredBy !== userId && <Button size="sm" onClick={() => setSigning(t)}>Verify</Button>}
          {t.status === "ENTERED" && canVerify && t.enteredBy !== userId && <Button size="sm" onClick={() => setRejecting(t)}>Reject</Button>}
        </div>
      ),
    },
  ];

  if (queryState === "ready" && sessions.length === 0 && total === 0) return null;
  return (
    <>
      <TabBlock title="Results from paper">
        <p className="px-4 py-3 text-xs text-slate-500">
          Type what the signed paper says, with the scan attached. A different person then checks the lines against the scan and signs; only then are attendance and scores recorded.
          {canEnter && sessions.length > 0 && " Use the button of the session."}
        </p>
        {queryState === "error" && <p role="alert" className="px-4 text-sm text-red-700">Unable to load transcription status. Try again.</p>}
        {canEnter && sessions.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {sessions.map((s) => (
              <Button key={s.id} size="sm" variant="outline-emerald" disabled={queryState !== "ready" || waiting(s.id) || open(s.id).length === 0} onClick={() => setEntering(s)}>
                Type results of session {s.sessionNo}{queryState === "loading" ? " (loading)" : waiting(s.id) ? " (waiting to be checked)" : open(s.id).length === 0 ? " (nobody left)" : ""}
              </Button>
            ))}
          </div>
        )}
        <DataTable rows={items} getRowKey={(t) => t.id} columns={columns} emptyState={<p className="p-4 text-sm text-slate-500">Nothing typed from paper yet.</p>}
          pagination={total > 0 ? <TablePagination currentPage={page} totalPages={pages} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(value) => { setLimit(value); setPage(1); }} /> : undefined} />
      </TabBlock>

      {entering && (
        <EnterDialog
          session={entering}
          people={open(entering.id).map((p) => ({ id: p.id, name: p.fullName, noAssessment: (p.participationRole ?? "TRAINEE") !== "TRAINEE" }))}
          evidence={evidence}
          busy={busy}
          onClose={() => setEntering(undefined)}
          onSave={async (body) => {
            setBusy(true);
            try {
              await trainingTranscriptionApi.enter(entering.id, body);
              setEntering(undefined);
              done("Typed. Waiting for a second person to check it");
            } catch (e) {
              fail(e);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {viewing && (
        <FormModal isOpen onClose={() => setViewing(undefined)} onConfirm={() => setViewing(undefined)} title={`Session ${viewing.sessionNo}: Typed Lines`} confirmText="Close" size="lg">
          <DataTable
            rows={viewing.lines}
            getRowKey={(l) => l.participantId}
            columns={lineColumns}
          />
        </FormModal>
      )}

      {rejecting && <RejectDialog busy={busy} onClose={() => setRejecting(undefined)} onSave={async (reason) => {
        setBusy(true);
        try { await trainingTranscriptionApi.reject(rejecting.id, reason); setRejecting(undefined); done("Rejected"); } catch (e) { fail(e); } finally { setBusy(false); }
      }} />}

      <ESignatureModal
        isOpen={!!signing}
        onClose={() => setSigning(undefined)}
        onConfirm={async (data: { signatureToken: string }) => {
          if (!signing) return;
          try { await trainingTranscriptionApi.verify(signing.id, data.signatureToken); setSigning(undefined); done("Verified. Attendance and scores are recorded"); } catch (e) { fail(e); }
        }}
        actionTitle="Verify the Typed Results Against the Scan"
        changes={statusChange("Entered", "Verified", "Typed results")}
        meaningDisplayName="Transcription Verified"
        meaningCode="TRAINING_TRANSCRIPTION_VERIFIED"
        targetDetails={{ code: activity.trainingNumber, title: (activity.trainingTopics ?? ""), revision: "" }}
      />
    </>
  );
}

function RejectDialog({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <FormModal isOpen onClose={onClose} onConfirm={() => onSave(reason.trim())} title="Reject the Transcription" description="The lines do not match the scan. The person who typed them types again; this one stays on record." confirmText="Reject" confirmVariant="destructive" isLoading={busy} confirmDisabled={!reason.trim()} size="md">
      <FormField label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
    </FormModal>
  );
}

function EnterDialog({ session, people, evidence, busy, onClose, onSave }: {
  session: TrainingSession; people: { id: string; name: string; /** A trainer, a person who only attends or is only listed: no score is typed for them. */ noAssessment?: boolean }[]; evidence: TrainingPaperEvidence[]; busy: boolean; onClose: () => void;
  onSave: (body: { evidenceId: string; idempotencyKey: string; lateReason?: string; lines: { participantId: string; state: string; absenceReason?: string; scoreObtained?: number; scoreMax?: number }[] }) => void;
}) {
  const scored = Boolean(session.assessmentMethod) && session.assessmentMethod !== "SELF_READING_CONFIRMATION";
  // One key for each opening of the form: a second click or a retry gives back the first transcription instead of a second one.
  const key = useMemo(() => crypto.randomUUID(), []);
  const [evidenceId, setEvidenceId] = useState("");
  const [late, setLate] = useState("");
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(people.map((p) => [p.id, { state: "ATTENDED", got: "", max: "", reason: "" }])));
  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const valid = evidenceId && people.every((p) => {
    const r = rows[p.id];
    if (r.state === "ABSENT") return r.reason.trim().length > 0;
    if (!scored || p.noAssessment) return true;
    const got = num(r.got), max = num(r.max);
    return Number.isFinite(got) && Number.isFinite(max) && max > 0 && got >= 0 && got <= max;
  });
  return (
    <FormModal
      isOpen
      onClose={onClose}
      onConfirm={() => onSave({
        evidenceId,
        idempotencyKey: key,
        lateReason: late.trim() || undefined,
        lines: people.map((p) => {
          const r = rows[p.id];
          return r.state === "ABSENT" ? { participantId: p.id, state: "ABSENT", absenceReason: r.reason.trim() } : { participantId: p.id, state: "ATTENDED", ...(scored && !p.noAssessment ? { scoreObtained: num(r.got), scoreMax: num(r.max) } : {}) };
        }),
      })}
      title={`Type the Results of Session ${session.sessionNo}`}
      description="Copy what the signed paper says. The scan is required, and a different person checks it before anything is recorded."
      confirmText="Submit for checking"
      isLoading={busy}
      confirmDisabled={!valid}
      size="xl"
    >
      <div className="space-y-4">
        <FormField label="Scan of the paper" required>
          {evidence.length === 0
            ? <p className="text-sm text-amber-700">No scan yet. Upload the signed sheet under Training Materials, paper evidence, kind Attendance sheet or Assessment.</p>
            : <Select value={evidenceId} options={evidence.map((e) => ({ value: e.id, label: `${e.originalName} (${day(e.uploadedAt)})` }))} placeholder="Choose the scan" onChange={setEvidenceId} />}
        </FormField>
        <FormField label="Reason for typing late (needed when more than one day has passed)">
          <Input value={late} onChange={(e) => setLate(e.target.value)} />
        </FormField>
        <div className="space-y-2">
          {people.map((p, i) => {
            const r = rows[p.id];
            return (
              <div key={p.id} className="grid grid-cols-1 items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-12">
                <div className="md:col-span-3"><div className="text-xs text-slate-500">{i + 1}</div><div className="text-sm font-medium text-slate-900">{p.name}</div></div>
                <div className="md:col-span-3"><Select value={r.state} options={[{ value: "ATTENDED", label: "Attended" }, { value: "ABSENT", label: "Absent" }]} aria-label={`Attendance of ${p.name}`} onChange={(v) => set(p.id, { state: v })} /></div>
                {r.state === "ABSENT"
                  ? <div className="md:col-span-6"><Input placeholder="Reason for the absence" aria-label={`Reason of ${p.name}`} value={r.reason} onChange={(e) => set(p.id, { reason: e.target.value })} /></div>
                  : scored && p.noAssessment
                    ? <div className="text-sm text-slate-500 md:col-span-6">Takes no assessment</div>
                    : scored && (
                    <div className="flex items-center gap-2 md:col-span-6">
                      <Input type="number" inputMode="decimal" min={0} step="0.01" placeholder="Score" aria-label={`Score of ${p.name}`} value={r.got} onChange={(e) => set(p.id, { got: e.target.value })} />
                      <span className="text-slate-400">/</span>
                      <Input type="number" inputMode="decimal" min={0} step="0.01" placeholder="Maximum" aria-label={`Maximum score for ${p.name}`} value={r.max} onChange={(e) => set(p.id, { max: e.target.value })} />
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </FormModal>
  );
}
