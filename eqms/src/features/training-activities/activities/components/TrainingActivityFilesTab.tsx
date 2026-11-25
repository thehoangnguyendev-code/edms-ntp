import { TrainingMaterialPreviewModal } from "./TrainingMaterialPreviewModal";
import { useCallback, useEffect, useState } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { Lock, MoreVertical } from "lucide-react";
import {
  IconDownload,
  IconPhotoShare,
  IconRosetteDiscountCheck,
} from "@tabler/icons-react";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "../../shared/TrainingFields";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
  type DataTableColumnLayout,
} from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import {
  trainingError,
  trainingFilesApi,
  trainingPaperApi,
  type TrainingPaperPack,
  type TrainingActivityFiles,
  type TrainingMaterial,
  type TrainingPaperEvidence,
  type TrainingParticipant,
} from "@/services/api/trainingActivities";
import { day, when } from "../../shared/trainingLabels";
import { TrainingFileDropzone } from "../../shared/TrainingFileDropzone";
import { TrainingScanBatchUpload } from "./TrainingScanBatchUpload";
import { SpecimenViewModal } from "../../shared/SpecimenViewModal";
import { TabBlock } from "../../shared/TrainingDetailLayout";
import type { ActivityMode } from "../TrainingActivityDetailPage";
import { Popover } from "@/components/ui/popover/Popover";
import { LedgerEmpty, LedgerList, LedgerNote, LedgerRow } from "./workspace/ledger";
import { TrainingMaterialsReader } from "./TrainingMaterialsReader";
import { TrainingMaterialsBoard, type MaterialItem, type TrainingMaterialsLayout } from "./TrainingMaterialsBoard";
import { useBranding } from "@/components/branding/BrandLogo";
import { tr } from "@/i18n";
import { TrainingDocumentSources } from "./TrainingDocumentSources";
import { trainingDocumentSourcesApi, type TrainingDocumentSource } from "@/services/api/trainingActivities";

const KIND_LABEL: Record<string, string> = {
  ATTENDANCE_SHEET: "Attendance sheet",
  ASSESSMENT: "Test or checklist",
  CERTIFICATE: "Certificate",
  OTHER: "Other",
};
const ACCEPT = ".pdf,.docx,.xlsx,.pptx";
const size = (bytes: number) =>
  bytes > 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function save(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

type Sending = { file: File; percent: number };
const EMPTY_EVIDENCE = {
  file: null as File | null,
  kind: "ATTENDANCE_SHEET",
  participantId: "",
  remark: "",
  formUsed: "",
  packId: "",
};

/**
 * The files of an activity: the materials (file or link), the exam and the answer key, and the scans of what was signed on paper. Each file has a fingerprint and is never
 * changed or deleted. Materials and the exam are added in the Edit screen, the scans in the Conduct screen; every other screen only looks.
 */
export function TrainingActivityFilesTab({
  activityId,
  participants,
  part,
  mode,
  external = false,
  formKind = "TEST",
  materialsNeeded = true,
  formNeeded = true,
  note = null,
  readOnlyNote,
  materialsReadOnly = false,
  reader = false,
  visible,
  onSummary,
  sessionId,
  sessions,
}: {
  activityId: string;
  participants: TrainingParticipant[];
  part: "materials" | "assessment";
  mode: ActivityMode;
  external?: boolean;
  /** What the sessions ask of an assessment form: a test, a checklist, both or no file. */
  formKind?: "TEST" | "CHECKLIST" | "BOTH" | "NONE";
  /** False when the activity needs no material (exempted, or free by rule): the upload is not offered. */
  materialsNeeded?: boolean;
  /** False when the activity needs no assessment form: the slots of the test and of the answer key are not offered. */
  formNeeded?: boolean;
  /** Why the table has no line when nothing is needed (no test, no checklist, no material), with the reason of the organizer. */
  note?: string | null;
  /** The same note without the advice to add material: used for the materials once they can no longer be added (the content is approved, the training is running). */
  readOnlyNote?: string | null;
  /** True in the Session Workspace: the test and the answer key that the plan holds are shown, never added, changed or removed there. */
  materialsReadOnly?: boolean;
  /** True in the Session Workspace: the materials are drawn as a list with a detail panel, whatever layout the administrator chose for the planning screens. */
  reader?: boolean;
  /** With `reader` on the assessment part: which of its two sections is on screen (the other stays mounted, hidden). */
  visible?: "materials" | "scans";
  /** The Session Workspace asks to be told what the assessment blocks hold (the exam file, the scans and how many are still unchecked). */
  onSummary?: (summary: { materials?: { examUploaded: boolean }; scans?: { total: number; unchecked: number } }) => void;
  /** The session the tab looks at: its own materials and forms and the ones shared by every session. Left out for all of them. */
  sessionId?: string;
  /** The sessions of the activity, for the field "Use for" of a new material (only when it has more than one). */
  sessions?: { id: string; label: string }[];
}) {
  const { showToast } = useToast();
  const [files, setFiles] = useState<TrainingActivityFiles>();
  // The documents of Document Control that are the material of a training that comes from a document (the document and every document it lists as related).
  const [sourceDocs, setSourceDocs] = useState<TrainingDocumentSource[]>([]);
  useEffect(() => { trainingDocumentSourcesApi.get(activityId).then((r) => setSourceDocs(r.documents)).catch(() => setSourceDocs([])); }, [activityId]);
  // The session a new material is for ("" is every session): the one the tab looks at, until the person chooses another.
  const [target, setTarget] = useState(sessionId ?? "");
  useEffect(() => { setTarget(sessionId ?? ""); }, [sessionId]);
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState<{ id: string; name: string; type: "pdf" | "docx" }>();
  const [busy, setBusy] = useState(false);
  const menu = usePortalDropdown();
  const { trainingMaterialsLayout } = useBranding();
  const materialsLayout: TrainingMaterialsLayout = trainingMaterialsLayout === "TILES" ? "TILES" : "TABLE";
  const [sending, setSending] = useState<Record<string, Sending | undefined>>(
    {},
  );
  const [evidence, setEvidence] = useState(EMPTY_EVIDENCE);
  const [removing, setRemoving] = useState<{ id: string; reason: string }>();
  const [packs, setPacks] = useState<TrainingPaperPack[]>([]);
  // the specimen signature of the person of a scan, opened beside it for the check against the paper
  const [specimenOf, setSpecimenOf] = useState<{ personId: string; name: string }>();

  const load = useCallback(() => {
    trainingFilesApi
      .list(activityId)
      .then(setFiles)
      .catch((e) => setError(trainingError(e)));
    // the numbered paper copies of the activity: a scan can say which copy it is the scan of
    trainingPaperApi.packs(activityId).then(setPacks).catch(() => setPacks([]));
  }, [activityId]);
  useEffect(load, [load]);
  useEntityChanged(["TRAINING"], load);
  useEffect(() => {
    if (part !== "assessment" || !files || !onSummary) return;
    const exam = files.materials.some((m) => m.purpose === "EXAM" && !m.removedAt);
    onSummary({
      materials: !external && ((formKind !== "NONE" && formNeeded) || exam) ? { examUploaded: exam } : undefined,
      scans: mode !== "edit" ? { total: files.evidence.length, unchecked: files.evidence.filter((e) => !e.receivedAt).length } : undefined,
    });
  }, [part, files, external, formKind, formNeeded, mode, onSummary]);
  const run = async (
    action: () => Promise<TrainingActivityFiles>,
    done: string,
  ) => {
    setBusy(true);
    try {
      setFiles(await action());
      showToast({ type: "success", title: done, message: "" });
      return true;
    } catch (e) {
      showToast({
        type: "error",
        title: tr("The action was not done"),
        message: trainingError(e),
      });
      return false;
    } finally {
      setBusy(false);
    }
  };
  /** An upload with its progress (0 to 100) shown on the file card of `slot`. */
  const upload = async (
    slot: string,
    file: File,
    send: (
      onProgress: (percent: number) => void,
    ) => Promise<TrainingActivityFiles>,
    done: string,
  ) => {
    setSending((old) => ({ ...old, [slot]: { file, percent: 0 } }));
    try {
      setFiles(
        await send((percent) =>
          setSending((old) => ({ ...old, [slot]: { file, percent } })),
        ),
      );
      showToast({ type: "success", title: done, message: "" });
      return true;
    } catch (e) {
      showToast({
        type: "error",
        title: tr("The file was not uploaded"),
        message: trainingError(e),
      });
      return false;
    } finally {
      setSending((old) => ({ ...old, [slot]: undefined }));
    }
  };
  const download = async (fetcher: () => Promise<Blob>, name: string) => {
    try {
      save(await fetcher(), name);
    } catch (e) {
      showToast({
        type: "error",
        title: tr("The file could not be downloaded"),
        message: trainingError(e),
      });
    }
  };
  /** Opens the file in a window over the screen: a PDF in the project PDF viewer, a Word file in the OnlyOffice viewer. Nothing is converted. */
  const previewType = (name?: string | null) =>
    name?.toLowerCase().endsWith(".pdf")
      ? "pdf"
      : name?.toLowerCase().endsWith(".docx")
        ? "docx"
        : null;
  const preview = (id: string, name?: string | null) => {
    const type = previewType(name);
    if (type) setPreviewing({ id, name: name ?? "", type });
  };

  if (!files)
    return error ? (
      <p role="alert" className="text-sm text-red-700">
        {error}
      </p>
    ) : (
      <SectionLoading text="Loading files…" />
    );

  const canAddMaterial = !materialsReadOnly && mode === "edit" && files.canUploadMaterial && materialsNeeded;
  const canAddEvidence = mode === "conduct" && files.canUploadEvidence;
  const canReceive = mode === "conduct" && files.canReceive;
  const inScope = (m: TrainingMaterial) => !sessionId || !m.sessionId || m.sessionId === sessionId;
  const toItem = (m: TrainingMaterial): MaterialItem => ({
    id: m.id,
    sessionLabel: sessions && sessions.length > 1 ? (m.sessionId ? `S${m.sessionNo ?? ""}` : tr("All sessions")) : null,
    title: m.title,
    linkUrl: m.linkUrl,
    fileName: m.originalName,
    sizeBytes: m.sizeBytes,
    sha256: m.sha256,
    addedBy: `${m.uploadedByName} (${day(m.createdAt)})`,
    removedAt: m.removedAt ? day(m.removedAt) : null,
    removeReason: m.removeReason,
  });

  const evidenceColumns: DataTableColumn<TrainingPaperEvidence>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "kind", header: "Type", cell: (e) => KIND_LABEL[e.kind] ?? e.kind },
    {
      id: "file",
      header: "File",
      cell: (e) => `${e.originalName} (${size(e.sizeBytes)})`,
    },
    { id: "form", header: "Form used", cell: (e) => e.formUsed ?? "—" },
    { id: "copy", header: tr("Paper copy"), cell: (e) => e.packCode ?? "—" },
    {
      id: "person",
      header: "For",
      cell: (e) => e.participantName ?? "The whole session",
    },
    {
      id: "by",
      header: tr("Uploaded by"),
      cell: (e) => `${e.uploadedByName} (${day(e.uploadedAt)})`,
    },
    {
      id: "received",
      header: tr("Checked against the paper"),
      cell: (e) =>
        e.receivedAt ? (
          <Badge color="emerald">
            {e.receivedByName}, {when(e.receivedAt)}
          </Badge>
        ) : (
          <Badge color="amber">{tr("Not yet")}</Badge>
        ),
    },
    {
      id: "remark",
      header: "Remark",
      cell: (e) => (
        <div className="max-w-60 whitespace-normal">{e.remark ?? "—"}</div>
      ),
    },
  ];

  // The last column is the pinned Action column with the menu of the row, as in the other tables; the No. column stays in view on the left.
  const menuButton = (id: string) => (
    <button
      type="button"
      ref={menu.getRef(id)}
      aria-label={tr("More actions")}
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
      onClick={(event) => menu.toggle(id, event)}
    >
      <MoreVertical className="h-4 w-4" />
    </button>
  );
  const evidenceAction: DataTableAction<TrainingPaperEvidence> = {
    cell: (e) => menuButton(e.id),
  };
  const evidenceLayout: DataTableColumnLayout<TrainingPaperEvidence> = {
    columns: evidenceColumns,
    pinnedIds: ["rowNo"],
  };
  const openMaterial = files.materials.find((m) => m.id === menu.openId);
  const openEvidence = files.evidence.find((e) => e.id === menu.openId);

  // the form of the session itself comes first, then the one shared by every session
  const slotOf = (purpose: "EXAM" | "ANSWER_KEY") =>
    files.materials.find((m) => m.purpose === purpose && !m.removedAt && !!sessionId && m.sessionId === sessionId) ?? files.materials.find((m) => m.purpose === purpose && !m.removedAt && inScope(m));
  // The exam file and the answer key come only from an approved assessment of the library (chosen above): here they are looked at and saved, never added, edited or removed.
  const assessmentZone = (purpose: "EXAM" | "ANSWER_KEY") => {
    const current = slotOf(purpose);
    const isKey = purpose === "ANSWER_KEY";
    const zoneLabel = isKey ? tr("Answer Key (optional)") : formKind === "CHECKLIST" ? tr("Checklist Form") : formKind === "BOTH" ? tr("Test or Checklist Form") : "Exam";
    return (
      <TrainingFileDropzone
        label={zoneLabel}
        accept=".pdf,.docx"
        maxMb={20}
        hint=""
        file={null}
        disabled
        existing={
          current
            ? {
                name: current.originalName ?? "file",
                size: current.sizeBytes ?? 0,
                note: `${current.uploadedByName}, ${day(current.createdAt)}`,
                onPreview: previewType(current.originalName) ? () => preview(current.id, current.originalName) : undefined,
                onDownload: () => void download(() => trainingFilesApi.downloadMaterial(current.id), current.originalName ?? "file"),
              }
            : undefined
        }
        readOnlyText={current ? undefined : isKey ? tr("The answer key appears here with the exam, from the approved assessment you choose above.") : tr("The exam appears here, made from the approved assessment you choose above.")}
        onChange={() => undefined}
      />
    );
  };

  const addEvidence = async () => {
    const e = evidence;
    if (!e.file) return;
    const ok = await upload(
      "evidence",
      e.file,
      (onProgress) =>
        trainingFilesApi.uploadEvidence(
          activityId,
          e.file as File,
          e.kind,
          e.participantId || undefined,
          e.remark.trim() || undefined,
          onProgress,
          e.formUsed.trim() || undefined,
          e.packId || undefined,
        ),
      "File uploaded",
    );
    if (ok) setEvidence(EMPTY_EVIDENCE);
  };

  return (
    <div className="space-y-6">
      {part === "assessment" && (
        <>
          {external && mode !== "edit" && (
            <p className="text-sm text-slate-600">{tr("An external training has no exam. Keep the certificate or the proof of attendance below.")}</p>
          )}
          {/* No test or checklist session and nothing uploaded: there is no form to show. The answer key is for a test. */}
          {!external && ((formKind !== "NONE" && formNeeded) || !!slotOf("EXAM")) && (
            <div hidden={reader && visible !== undefined && visible !== "materials"} className="space-y-3">
              {!reader && (
                <h3 className="text-sm font-semibold text-slate-800">
                  {tr("Assessment Materials")}
                </h3>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                {assessmentZone("EXAM")}
                {files.canSeeAnswerKey && formKind !== "CHECKLIST" && assessmentZone("ANSWER_KEY")}
              </div>
            </div>
          )}
          {mode !== "edit" && (
          <div hidden={reader && visible !== undefined && visible !== "scans"} className={`space-y-4 ${reader && canAddEvidence ? "pt-4" : ""}`}>
            {!reader && <div id={reader ? "ws-assess-scans" : undefined} className="flex scroll-mt-24 items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800">
                {tr("Scans and filled files")}
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{files.evidence.length}</span>
              <Popover title={tr("Scans and filled files")} content={tr("A second person checks each scan against the paper.")} contentClassName="w-80 max-w-[calc(100vw-2rem)]" triggerAriaLabel={tr("About Scans and filled files")} />
            </div>}
            {canAddEvidence && !external && <TrainingScanBatchUpload activityId={activityId} onDone={load} />}
            {canAddEvidence && external && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                  <div className="md:col-span-2">
                    <TrainingFileDropzone
                      label={tr("Scan or filled file")}
                      required
                      accept={ACCEPT}
                      maxMb={20}
                      hint={tr("PDF or Office file, max 20 MB.")}
                      file={sending.evidence?.file ?? evidence.file}
                      uploading={
                        sending.evidence
                          ? { percent: sending.evidence.percent }
                          : undefined
                      }
                      onChange={(f) => setEvidence({ ...evidence, file: f })}
                    />
                  </div>
                  <FormField label={tr("Type")} required>
                    <Select
                      value={evidence.kind}
                      enableSearch={false}
                      onChange={(v) => setEvidence({ ...evidence, kind: v })}
                      options={Object.entries(KIND_LABEL).map(
                        ([value, label]) => ({ label, value }),
                      )}
                    />
                  </FormField>
                  <FormField label={tr("For one person (optional)")}>
                    <Select
                      value={evidence.participantId}
                      onChange={(v) =>
                        setEvidence({ ...evidence, participantId: v })
                      }
                      options={[
                        { label: tr("The whole session"), value: "" },
                        ...participants.map((p) => ({
                          label: p.fullName,
                          value: p.id,
                        })),
                      ]}
                    />
                  </FormField>
                  <FormField label={tr("Paper copy it is the scan of (optional)")}>
                    <Select
                      value={evidence.packId}
                      onChange={(v) => setEvidence({ ...evidence, packId: v })}
                      options={[
                        { label: tr("Not a numbered copy"), value: "" },
                        ...packs.map((p) => ({ label: `${p.packCode}${p.packKind === "EXAM" ? " (exam)" : ""}`, value: p.id })),
                      ]}
                    />
                  </FormField>
                  <FormField label={tr("Form and version used (optional)")}>
                    <Input
                      value={evidence.formUsed}
                      maxLength={80}
                      placeholder={tr("For example APD.0009 2.0.0")}
                      onChange={(e) =>
                        setEvidence({ ...evidence, formUsed: e.target.value })
                      }
                    />
                  </FormField>
                  <div className="md:col-span-2">
                    <FormField label={tr("Remark")}>
                      <Textarea
                        rows={2}
                        value={evidence.remark}
                        onChange={(e) =>
                          setEvidence({ ...evidence, remark: e.target.value })
                        }
                      />
                    </FormField>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{tr("A second person checks each scan against the paper.")}</p>
                <div>
                  <Button
                    size="sm"
                    variant="outline-emerald"
                    loading={!!sending.evidence}
                    disabled={!evidence.file}
                    onClick={() => void addEvidence()}
                  >
                    {tr("Upload")}
                  </Button>
                </div>
              </div>
            )}
            {reader ? (
              <>
                {/* the upload area above says the same sentence, so it is not said twice */}
                {!canAddEvidence && <LedgerNote>{tr("A second person checks each scan against the paper.")}</LedgerNote>}
                <div className="md:hidden">
                  {files.evidence.length === 0 ? (
                    <LedgerEmpty>{note ?? "No file yet."}</LedgerEmpty>
                  ) : (
                    <LedgerList>
                      {files.evidence.map((e) => (
                        <LedgerRow
                          key={e.id}
                          title={e.originalName}
                          meta={[`${KIND_LABEL[e.kind] ?? e.kind} · ${size(e.sizeBytes)}`, `for ${e.participantName ?? "the whole session"}`, e.packCode, e.formUsed, `uploaded by ${e.uploadedByName} (${day(e.uploadedAt)})`, e.remark].filter(Boolean).join(" · ")}
                          state={e.receivedAt ? `Checked by ${e.receivedByName}, ${when(e.receivedAt)}` : tr("Not yet checked")}
                          tone={e.receivedAt ? "mute" : "amber"}
                          primary={menuButton(e.id)}
                        />
                      ))}
                    </LedgerList>
                  )}
                </div>
                <div className="hidden md:block">
            <TabBlock>
              <DataTable
                rows={files.evidence}
                getRowKey={(e) => e.id}
                columns={evidenceColumns}
                columnLayout={evidenceLayout}
                action={evidenceAction}
                emptyState={
                  <p className="p-4 text-sm text-slate-500">
                    {note ?? "No file yet."}
                  </p>
                }
              />
            </TabBlock>
                </div>
              </>
            ) : (
            <TabBlock>
              <DataTable
                rows={files.evidence}
                getRowKey={(e) => e.id}
                columns={evidenceColumns}
                columnLayout={evidenceLayout}
                action={evidenceAction}
                emptyState={
                  <p className="p-4 text-sm text-slate-500">
                    {note ?? "No file yet."}
                  </p>
                }
              />
            </TabBlock>
            )}
          </div>
          )}
        </>
      )}
      {part === "materials" && reader && <TrainingDocumentSources documents={sourceDocs} />}
      {part === "materials" && reader && (
        <TrainingMaterialsReader
          items={files.materials.filter((m) => m.purpose === "CONTENT" && inScope(m)).map(toItem)}
          lockedNote={materialsNeeded && files.materials.some((m) => m.purpose === "CONTENT" && inScope(m)) ? tr("Materials can be added or removed in the planning step, until the content is approved. You can still open them here.") : undefined}
          emptyText={(readOnlyNote !== undefined ? readOnlyNote : note) ?? (materialsNeeded ? tr("No material yet. A file (PDF, slides, video) or a link can be added in the planning step.") : tr("No material is needed for this training."))}
          onPreview={(m) => preview(m.id, m.fileName)}
          onDownload={(m) => void download(() => trainingFilesApi.downloadMaterial(m.id), m.fileName ?? "file")}
        />
      )}
      {part === "materials" && !reader && (
        <>
          <TrainingDocumentSources documents={sourceDocs} />
          <TrainingMaterialsBoard
            layout={materialsLayout}
            items={files.materials.filter((m) => m.purpose === "CONTENT" && inScope(m)).map(toItem)}
            canAdd={canAddMaterial}
            canRemove={canAddMaterial}
            lockedNote={!canAddMaterial && materialsNeeded && files.materials.some((m) => m.purpose === "CONTENT" && inScope(m)) ? tr("Materials can be added or removed in the planning step, until the content is approved. You can still open them here.") : undefined}
            emptyText={
              (canAddMaterial || readOnlyNote === undefined ? note : readOnlyNote) ??
              (materialsNeeded
                ? (canAddMaterial ? tr("No material yet. A file (PDF, slides, video) or a link can be added until the content is approved.") : tr("No material was added."))
                : tr("No material is needed for this training."))
            }
            busy={busy}
            sending={sending.material}
            onAddFile={(file, title) =>
              upload("material", file, (onProgress) => trainingFilesApi.uploadMaterial(activityId, file, title || undefined, "CONTENT", onProgress, target || undefined), "File added")
            }
            scope={sessions && sessions.length > 1 ? { label: tr("Use for"), value: target, options: [{ label: tr("All sessions"), value: "" }, ...sessions.map((x) => ({ label: x.label, value: x.id }))], onChange: setTarget } : undefined}
            onAddLink={(title, url) => run(() => trainingFilesApi.addLink(activityId, title, url, target || undefined), "Link added")}
            onRemove={(m) => setRemoving({ id: m.id, reason: "" })}
            onPreview={(m) => preview(m.id, m.fileName)}
            onDownload={(m) => void download(() => trainingFilesApi.downloadMaterial(m.id), m.fileName ?? "file")}
          />
        </>
      )}

      <PortalDropdownMenu
        isOpen={!!openEvidence}
        onClose={menu.close}
        position={menu.position}
        minWidth={220}
      >
        {openEvidence && (
          <div className="py-1">
            <DropdownMenuItem
              icon={<IconDownload className="h-4 w-4" />}
              onClick={() => {
                menu.close();
                void download(
                  () => trainingFilesApi.downloadEvidence(openEvidence.id),
                  openEvidence.originalName,
                );
              }}
            >
              {tr("Download")}
            </DropdownMenuItem>
            {openEvidence.participantId && participants.find((p) => p.id === openEvidence.participantId)?.personUserId && (
              <DropdownMenuItem
                icon={<IconPhotoShare className="h-4 w-4" />}
                onClick={() => {
                  menu.close();
                  const person = participants.find((p) => p.id === openEvidence.participantId);
                  if (person?.personUserId) setSpecimenOf({ personId: person.personUserId, name: person.fullName });
                }}
              >
                {tr("View Specimen Signature")}
              </DropdownMenuItem>
            )}
            {canReceive && !openEvidence.receivedAt && (
              <DropdownMenuItem
                icon={<IconRosetteDiscountCheck className="h-4 w-4" />}
                onClick={() => {
                  menu.close();
                  void run(
                    () => trainingFilesApi.receiveEvidence(openEvidence.id),
                    "Scan received",
                  );
                }}
              >
                {tr("I checked it against the paper")}
              </DropdownMenuItem>
            )}
          </div>
        )}
      </PortalDropdownMenu>

      {specimenOf && <SpecimenViewModal personId={specimenOf.personId} personName={specimenOf.name} onClose={() => setSpecimenOf(undefined)} />}
      <FormModal
        isOpen={!!removing}
        onClose={() => setRemoving(undefined)}
        title={tr("Remove File")}
        description={tr("The file stays on record, marked as removed with your reason.")}
        confirmText="Remove"
        confirmVariant="destructive"
        isLoading={busy}
        confirmDisabled={!removing?.reason.trim()}
        size="md"
        onConfirm={async () => {
          if (
            removing &&
            (await run(
              () =>
                trainingFilesApi.removeMaterial(
                  removing.id,
                  removing.reason.trim(),
                ),
              "File removed",
            ))
          )
            setRemoving(undefined);
        }}
      >
        <FormField label={tr("Reason")} required>
          <Textarea
            rows={3}
            value={removing?.reason ?? ""}
            onChange={(e) =>
              removing && setRemoving({ ...removing, reason: e.target.value })
            }
          />
        </FormField>
      </FormModal>
      {previewing && <TrainingMaterialPreviewModal materialId={previewing.id} name={previewing.name} kind={previewing.type} onClose={() => setPreviewing(undefined)} />}
    </div>
  );
}
