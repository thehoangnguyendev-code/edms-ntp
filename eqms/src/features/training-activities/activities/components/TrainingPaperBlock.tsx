import { useCallback, useEffect, useState } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast/Toast";
import { DataTable, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
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
  /** Any numbered copy of the session, of any kind: the server asks for a reason to change the delivery after the first one, so the screen asks too. */
  const hasPrint = (sessionId: string) => packs.some((p) => p.sessionId === sessionId);
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
  /** Lost and Voided ask for the reason first; Returned is never set by hand, it follows the upload of the scan. */
  const markCopy = async (pack: TrainingPaperPack, status: "LOST" | "VOIDED", why?: string) => {
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
  return { packs, printed, hasPrint, printedExam, busy, ask: setAsk, print, printExam, changeMode, dialog: <>{dialog}{copyDialog}</>, markCopy, askCopy: setCopyAsk };
}

/**
 * The numbered paper copies of an activity (PLAN-TR-001 17.7), as a record: who printed each one and when, how many scans it has and where it is. The printing and the delivery of a session are done in
 * the Prepare step; a copy comes back only by the upload of its scan (the server closes it as Returned), so the person here can only record a copy as Lost or Voided.
 */
export function TrainingPrintedPacks({ activity, onChanged }: { activity: TrainingActivityDetail; onChanged: () => void }) {
  const { packs, busy, dialog, askCopy } = useTrainingPaper(activity, onChanged);
  const drag = useTableDragScroll();
  if (packs.length === 0) return null;
  const open = packs.filter((p) => p.status === "ISSUED").length;
  const packColumns: DataTableColumn<TrainingPaperPack>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_p, i) => i + 1 },
    { id: "code", header: "Pack", cell: (p) => `${p.packCode}${p.packKind === "EXAM" ? " (exam)" : ""}` },
    { id: "copy", header: "Copy", cell: (p) => p.copyNo },
    { id: "pages", header: "Pages", cell: (p) => p.pageCount },
    { id: "people", header: "Trainees", cell: (p) => p.peopleCount },
    { id: "by", header: "Printed by", cell: (p) => p.printedByName },
    { id: "at", header: "Printed at", cell: (p) => displayDateTime(p.printedAt) },
    { id: "reason", header: "Reason", cell: (p) => <div className="max-w-64 whitespace-normal">{p.reason ?? "—"}</div> },
    { id: "scans", header: "Scans", cell: (p) => (p.scanCount > 0 ? p.scanCount : "—") },
  ];
  // Where the copy is stays at the right edge while the table scrolls sideways: it is the column the person acts on.
  const where: DataTableAction<TrainingPaperPack> = {
    header: "Where is the copy",
    cell: (p) => (p.status === "ISSUED" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="amber">Issued</Badge>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => askCopy({ pack: p, status: "LOST" })}>Lost</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => askCopy({ pack: p, status: "VOIDED" })}>Void</Button>
        </div>
      ) : (
        <div className="max-w-64 whitespace-normal">
          <Badge color={p.status === "RETURNED" ? "emerald" : "red"}>{p.status === "RETURNED" ? "Returned" : p.status === "LOST" ? "Lost" : "Voided"}</Badge>
          <div className="text-xs text-slate-500">{p.statusByName} · {p.statusAt ? displayDateTime(p.statusAt) : ""}{p.statusReason ? ` · ${p.statusReason}` : ""}</div>
        </div>
      )),
    cellClassName: "text-left",
    headerClassName: "text-left",
  };
  return (
    <div className="space-y-6">
      <TabBlock title="Printed packs">
        {open > 0 && (
          <p role="status" className="px-4 py-3 text-xs text-amber-700">
            {open} numbered copy(ies) are still Issued. A copy is Returned when its scan is uploaded in Scans and filled files (choose the copy there); record it as Lost or Voided if the paper will not come back. Do this before the training is confirmed as completed; QA can still confirm, and the open copies are written in the Audit Trail.
          </p>
        )}
        <DataTable rows={packs} getRowKey={(p) => p.id} columns={packColumns} action={where} scrollerRef={drag.scrollerRef} scrollProps={drag.dragEvents} isDragging={drag.isDragging} />
      </TabBlock>
      {dialog}
    </div>
  );
}
