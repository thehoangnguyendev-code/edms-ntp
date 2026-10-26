import { useCallback, useEffect, useState } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { trainingError, trainingPaperApi, type TrainingActivityDetail, type TrainingPaperPack, type TrainingSession } from "@/services/api/trainingActivities";
import { Textarea } from "../../shared/TrainingFields";
import { TabBlock } from "../../shared/TrainingDetailLayout";
import { saveBlob } from "../../shared/trainingLabels";
import { displayDateTime } from "@/utils/format";

export const DELIVERY_LABEL: Record<string, string> = { ELECTRONIC: "Electronic", PAPER: "Paper", MIXED: "Mixed" };
const DELIVERY_OPTIONS = Object.entries(DELIVERY_LABEL).map(([value, label]) => ({ value, label }));

type Ask = { kind: "mode"; session: TrainingSession; mode: string } | { kind: "print"; session: TrainingSession } | { kind: "exam"; session: TrainingSession; format: "pdf" | "docx" };

/** The state and the actions of the paper printing of one activity, shared by the Paper block and the checklist of the Prepare step. */
export function useTrainingPaper(activity: TrainingActivityDetail, onChanged: () => void) {
  const { showToast } = useToast();
  const [packs, setPacks] = useState<TrainingPaperPack[]>([]);
  const [ask, setAsk] = useState<Ask>();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyAsk, setCopyAsk] = useState<{ pack: TrainingPaperPack; status: "LOST" | "VOIDED" }>();

  const load = useCallback(() => { if (!activity.id) return; trainingPaperApi.packs(activity.id).then(setPacks).catch(() => setPacks([])); }, [activity.id]);
  useEffect(load, [load]);
  useEntityChanged(["TRAINING"], load);

  const printed = (sessionId: string) => packs.filter((p) => p.sessionId === sessionId && p.packKind === "ATTENDANCE").length;
  const printedExam = (sessionId: string) => packs.filter((p) => p.sessionId === sessionId && p.packKind === "EXAM").length;
  const fail = (e: unknown) => showToast({ type: "error", title: "The action was not done", message: trainingError(e) });

  const print = async (session: TrainingSession, why?: string) => {
    setBusy(true);
    try {
      const blob = await trainingPaperApi.print(session.id, why);
      saveBlob(blob, `${activity.trainingNumber}-S${session.sessionNo}.pdf`);
      setAsk(undefined);
      setReason("");
      load();
    } catch (e) {
      // A blob error body is not JSON text; the stable code is read from it by trainingError when it can be.
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  /** One file for each trainee, in a ZIP (PDF to print, or Word to change before printing). */
  const printExam = async (session: TrainingSession, why?: string, format: "pdf" | "docx" = "pdf") => {
    setBusy(true);
    try {
      const blob = await trainingPaperApi.printExam(session.id, why, format);
      saveBlob(blob, `${activity.trainingNumber.replace(/\//g, "-")}-S${session.sessionNo}-test-copies-${format === "docx" ? "word" : "pdf"}.zip`);
      setAsk(undefined);
      setReason("");
      load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  /** Where a copy is: Returned goes straight; Lost and Voided ask for the reason first. */
  const markCopy = async (pack: TrainingPaperPack, status: "RETURNED" | "LOST" | "VOIDED", why?: string) => {
    setBusy(true);
    try {
      await trainingPaperApi.markCopy(pack.id, status, why);
      setCopyAsk(undefined);
      setReason("");
      load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const changeMode = async (session: TrainingSession, mode: string, why?: string) => {
    setBusy(true);
    try {
      await trainingPaperApi.setMode(session.id, mode, why);
      setAsk(undefined);
      setReason("");
      onChanged();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const copyDialog = copyAsk && (
    <FormModal
      isOpen
      onClose={() => { setCopyAsk(undefined); setReason(""); }}
      onConfirm={() => markCopy(copyAsk.pack, copyAsk.status, reason.trim())}
      title={`${copyAsk.status === "LOST" ? "Record the loss of" : "Void"} the copy ${copyAsk.pack.packCode}`}
      description="The copy is closed and does not change again. The reason stays in the Audit Trail."
      confirmText={copyAsk.status === "LOST" ? "Record loss" : "Void"}
      isLoading={busy}
      confirmDisabled={!reason.trim()}
      size="md"
    >
      <FormField label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
    </FormModal>
  );
  const dialog = ask && (
      <FormModal
        isOpen
        onClose={() => { setAsk(undefined); setReason(""); }}
        onConfirm={() => (ask.kind === "print" ? print(ask.session, reason.trim()) : ask.kind === "exam" ? printExam(ask.session, reason.trim(), ask.format) : changeMode(ask.session, ask.mode, reason.trim()))}
        title={ask.kind === "print" ? `Reprint the paper pack of session ${ask.session.sessionNo}` : ask.kind === "exam" ? `Reprint the exam copies of session ${ask.session.sessionNo}` : `Change the delivery of session ${ask.session.sessionNo}`}
        description={ask.kind !== "mode" ? "Another copy is numbered and recorded. Say why it is needed." : "A pack was already printed for this session. The reason stays in the Audit Trail."}
        confirmText={ask.kind !== "mode" ? "Print" : "Change"}
        isLoading={busy}
        confirmDisabled={!reason.trim()}
        size="md"
      >
        <FormField label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
      </FormModal>
  );
  return { packs, printed, printedExam, busy, ask: setAsk, print, printExam, changeMode, dialog: <>{dialog}{copyDialog}</>, markCopy, askCopy: setCopyAsk };
}

/**
 * Training held on paper (PLAN-TR-001 17.7): how each session is delivered, and the controlled print of its attendance and assessment sheet. The first print
 * needs no reason; a reprint, or a change of delivery after a print, needs one. The server decides and records; this block only asks.
 */
export function TrainingPaperBlock({ activity, canPrint, canMode, onChanged }: { activity: TrainingActivityDetail; canPrint: boolean; canMode: boolean; onChanged: () => void }) {
  const { packs, printed, printedExam, busy, ask: setAsk, print, printExam, changeMode, dialog, markCopy, askCopy } = useTrainingPaper(activity, onChanged);
  const sessions = activity.sessions.filter((s) => s.status !== "CANCELLED");
  if (sessions.length === 0) return null;
  const columns: DataTableColumn<TrainingSession>[] = [
    { id: "no", header: "Session", cell: (s) => `S${s.sessionNo}` },
    {
      id: "mode",
      header: "Delivery",
      cell: (s) => canMode && !["COMPLETED", "CANCELLED"].includes(activity.status)
        ? <div className="w-36"><Select value={s.deliveryMode ?? "ELECTRONIC"} options={DELIVERY_OPTIONS} aria-label={`Delivery of session ${s.sessionNo}`}
            onChange={(v) => { if (v === (s.deliveryMode ?? "ELECTRONIC")) return; if (printed(s.id) > 0) setAsk({ kind: "mode", session: s, mode: v }); else void changeMode(s, v); }} /></div>
        : DELIVERY_LABEL[s.deliveryMode ?? "ELECTRONIC"],
    },
    { id: "copies", header: "Copies printed", cell: (s) => printed(s.id) },
    { id: "examCopies", header: "Exam prints", cell: (s) => printedExam(s.id) },
    {
      id: "action",
      header: "Action",
      cell: (s) => canPrint && (s.deliveryMode ?? "ELECTRONIC") !== "ELECTRONIC" && s.status === "PLANNED"
        ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => (printed(s.id) > 0 ? setAsk({ kind: "print", session: s }) : void print(s))}>{printed(s.id) > 0 ? "Reprint pack" : "Print paper pack"}</Button>
            {(s.assessmentMethod === "TEST" || s.assessmentMethod === "CHECKLIST") && activity.contentRules?.assessmentFormSatisfied !== false && (
              <>
                <Button size="sm" disabled={busy} onClick={() => (printedExam(s.id) > 0 ? setAsk({ kind: "exam", session: s, format: "pdf" }) : void printExam(s))}>{printedExam(s.id) > 0 ? "Reprint test copies" : "Download test copies"}</Button>
                <Button size="sm" variant="outline-emerald" disabled={busy} onClick={() => (printedExam(s.id) > 0 ? setAsk({ kind: "exam", session: s, format: "docx" }) : void printExam(s, undefined, "docx"))}>Download as Word</Button>
              </>
            )}
          </div>
        )
        : null,
    },
  ];
  const packColumns: DataTableColumn<TrainingPaperPack>[] = [
    { id: "code", header: "Pack", cell: (p) => `${p.packCode}${p.packKind === "EXAM" ? " (exam)" : ""}` },
    { id: "copy", header: "Copy", cell: (p) => p.copyNo },
    { id: "pages", header: "Pages", cell: (p) => p.pageCount },
    { id: "people", header: "Trainees", cell: (p) => p.peopleCount },
    { id: "by", header: "Printed by", cell: (p) => p.printedByName },
    { id: "at", header: "Printed at", cell: (p) => displayDateTime(p.printedAt) },
    { id: "reason", header: "Reason", cell: (p) => <div className="max-w-64 whitespace-normal">{p.reason ?? "—"}</div> },
    { id: "scans", header: "Scans", cell: (p) => (p.scanCount > 0 ? p.scanCount : p.status === "RETURNED" ? <span className="text-amber-700">None yet</span> : "—") },
    {
      id: "where",
      header: "Where is the copy",
      cell: (p) => (p.status === "ISSUED" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="amber">Issued</Badge>
          <Button size="sm" variant="outline-emerald" disabled={busy} onClick={() => void markCopy(p, "RETURNED")}>Returned</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => askCopy({ pack: p, status: "LOST" })}>Lost</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => askCopy({ pack: p, status: "VOIDED" })}>Void</Button>
        </div>
      ) : (
        <div className="max-w-64 whitespace-normal">
          <Badge color={p.status === "RETURNED" ? "emerald" : "red"}>{p.status === "RETURNED" ? "Returned" : p.status === "LOST" ? "Lost" : "Voided"}</Badge>
          <div className="text-xs text-slate-500">{p.statusByName} · {p.statusAt ? displayDateTime(p.statusAt) : ""}{p.statusReason ? ` · ${p.statusReason}` : ""}</div>
        </div>
      )),
    },
  ];

  return (
    <div className="space-y-6">
      <TabBlock title="Paper">
        <p className="px-4 py-3 text-xs text-slate-500">A session may be held on paper, in the room or in the workshop. The pack carries the Training Number on every page; each print is numbered and recorded.</p>
        <DataTable rows={sessions} getRowKey={(s) => s.id} columns={columns} />
      </TabBlock>
      {packs.length > 0 && (
        <TabBlock title="Printed packs">
          {packs.some((p) => p.status === "ISSUED") && (
            <p role="status" className="px-4 py-3 text-xs text-amber-700">
              {packs.filter((p) => p.status === "ISSUED").length} numbered copy(ies) are still Issued. Record each one as Returned (the signed paper is filed with the record), Lost or Voided before the training is confirmed as completed; QA can still confirm, and the open copies are written in the Audit Trail.
            </p>
          )}
          <DataTable rows={packs} getRowKey={(p) => p.id} columns={packColumns} />
        </TabBlock>
      )}
      {dialog}
    </div>
  );
}
