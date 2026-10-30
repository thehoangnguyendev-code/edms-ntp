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
  trainingFormTemplatesApi,
  trainingPaperApi,
  type AssessmentEditOpen,
  type TrainingPaperPack,
  type TrainingFormTemplateRef,
  type TrainingActivityFiles,
  type TrainingMaterial,
  type TrainingPaperEvidence,
  type TrainingParticipant,
} from "@/services/api/trainingActivities";
import { day, when } from "../../shared/trainingLabels";
import { TrainingFileDropzone } from "../../shared/TrainingFileDropzone";
import { SpecimenViewModal } from "../../shared/SpecimenViewModal";
import { TabBlock } from "../../shared/TrainingDetailLayout";
import type { ActivityMode } from "../TrainingActivityDetailPage";
import { TrainingAssessmentEditorFrame } from "./TrainingAssessmentEditorFrame";
import { TrainingMaterialsBoard, type MaterialItem, type TrainingMaterialsLayout } from "./TrainingMaterialsBoard";
import { useBranding } from "@/components/branding/BrandLogo";

const KIND_LABEL: Record<string, string> = {
  ATTENDANCE_SHEET: "Attendance sheet",
  ASSESSMENT: "Test or checklist",
  CERTIFICATE: "Certificate",
  OTHER: "Other",
};
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.pptx";
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
}) {
  const { showToast } = useToast();
  const [files, setFiles] = useState<TrainingActivityFiles>();
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
  const [templates, setTemplates] = useState<TrainingFormTemplateRef[]>([]);
  const [editing, setEditing] = useState<AssessmentEditOpen>();
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
  const canEditHere = mode === "edit" && !!files?.canUploadMaterial;
  useEffect(() => {
    if (canEditHere && part === "assessment")
      trainingFormTemplatesApi
        .current()
        .then((all) => setTemplates(all.filter((t) => t.code === "APD.0009")))
        .catch(() => setTemplates([]));
  }, [canEditHere, part]);
  // The editor saves into the activity while it is open; when it is closed the list is read again (the document server reports the last save a few seconds later).
  const closeEditor = () => {
    setEditing(undefined);
    load();
    window.setTimeout(load, 3000);
    window.setTimeout(load, 8000);
  };

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
        title: "The action was not done",
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
        title: "The file was not uploaded",
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
        title: "The file could not be downloaded",
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

  const canAddMaterial = mode === "edit" && files.canUploadMaterial && materialsNeeded;
  const canAddEvidence = mode === "conduct" && files.canUploadEvidence;
  const canReceive = mode === "conduct" && files.canReceive;
  const toItem = (m: TrainingMaterial): MaterialItem => ({
    id: m.id,
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
    { id: "copy", header: "Paper copy", cell: (e) => e.packCode ?? "—" },
    {
      id: "person",
      header: "For",
      cell: (e) => e.participantName ?? "The whole session",
    },
    {
      id: "by",
      header: "Uploaded by",
      cell: (e) => `${e.uploadedByName} (${day(e.uploadedAt)})`,
    },
    {
      id: "received",
      header: "Checked against the paper",
      cell: (e) =>
        e.receivedAt ? (
          <Badge color="emerald">
            {e.receivedByName}, {when(e.receivedAt)}
          </Badge>
        ) : (
          <Badge color="amber">Not yet</Badge>
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
      aria-label="More actions"
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

  const slotOf = (purpose: "EXAM" | "ANSWER_KEY") =>
    files.materials.find((m) => m.purpose === purpose && !m.removedAt);
  const assessmentZone = (purpose: "EXAM" | "ANSWER_KEY") => {
    const current = slotOf(purpose);
    const isKey = purpose === "ANSWER_KEY";
    const active = sending[purpose];
    const isDocx = !!current && previewType(current.originalName) === "docx";
    const examDocx = (() => {
      const exam = slotOf("EXAM");
      return !!exam && previewType(exam.originalName) === "docx";
    })();
    const editButtons =
      canEditHere && !active ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          {!isKey && !current && templates.map((t) => (
            <Button key={t.id} size="sm" variant="outline-emerald" disabled={busy} onClick={() => setEditing({ purpose: "EXAM", source: "TEMPLATE", templateId: t.id })}>
              Write it from {t.code} {t.versionLabel}
            </Button>
          ))}
          {!isKey && isDocx && (
            <Button size="sm" variant="outline-emerald" disabled={busy} onClick={() => setEditing({ purpose: "EXAM", source: "EXISTING" })}>
              Open to Edit
            </Button>
          )}
          {isKey && isDocx && (
            <Button size="sm" variant="outline-emerald" disabled={busy} onClick={() => setEditing({ purpose: "ANSWER_KEY", source: "EXISTING" })}>
              Open to Edit
            </Button>
          )}
          {isKey && !current && examDocx && (
            <Button size="sm" variant="outline-emerald" disabled={busy} onClick={() => setEditing({ purpose: "ANSWER_KEY", source: "EXAM_COPY" })}>
              Write it from the exam
            </Button>
          )}
          {!isKey && !current && templates.map((t) => (
            <button key={`d-${t.id}`} type="button" className="text-xs font-medium text-emerald-700 hover:underline" onClick={() => void download(() => trainingFormTemplatesApi.download(t.id), t.originalName)}>
              Download the blank form
            </button>
          ))}
        </div>
      ) : null;
    return (
      <div className="space-y-2">
        <TrainingFileDropzone
          label={isKey ? "Answer Key (optional)" : formKind === "CHECKLIST" ? "Checklist Form" : formKind === "BOTH" ? "Test or Checklist Form" : "Exam"}
          accept=".pdf,.docx"
          maxMb={20}
          hint={isKey ? "Word or PDF, max 20 MB. Only organizers and reviewers see it." : "Word or PDF, max 20 MB. It is printed for the employees."}
          file={active?.file ?? null}
          uploading={active ? { percent: active.percent } : undefined}
          disabled={busy || !!active}
          existing={
            !active && current
              ? {
                  name: current.originalName ?? "file",
                  size: current.sizeBytes ?? 0,
                  note: `${current.uploadedByName}, ${day(current.createdAt)}`,
                  onPreview: previewType(current.originalName)
                    ? () => preview(current.id, current.originalName)
                    : undefined,
                  onDownload: () =>
                    void download(
                      () => trainingFilesApi.downloadMaterial(current.id),
                      current.originalName ?? "file",
                    ),
                  onRemove: canAddMaterial
                    ? () => setRemoving({ id: current.id, reason: "" })
                    : undefined,
                }
              : undefined
          }
          readOnlyText={
            !active && !current && !canAddMaterial ? "No file." : undefined
          }
          onChange={(f) => {
            if (f)
              void upload(
                purpose,
                f,
                (onProgress) =>
                  trainingFilesApi.uploadMaterial(
                    activityId,
                    f,
                    undefined,
                    purpose,
                    onProgress,
                  ),
                isKey ? "Answer key added" : "Exam template added",
              );
          }}
        />
        {editButtons}
      </div>
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
      {editing && (
        <TrainingAssessmentEditorFrame
          activityId={activityId}
          request={editing}
          onClose={closeEditor}
        />
      )}
      {part === "assessment" && (
        <>
          {external && mode !== "edit" && (
            <p className="text-sm text-slate-600">An external training has no exam. Keep the certificate or the proof of attendance below.</p>
          )}
          {/* No test or checklist session and nothing uploaded: there is no form to show. The answer key is for a test. */}
          {!external && ((formKind !== "NONE" && formNeeded) || !!slotOf("EXAM")) && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">
                Assessment Materials
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                {assessmentZone("EXAM")}
                {files.canSeeAnswerKey && formKind !== "CHECKLIST" && assessmentZone("ANSWER_KEY")}
              </div>
            </div>
          )}
          {mode !== "edit" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">
              Scans and filled files
            </h3>
            {canAddEvidence && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                  <div className="md:col-span-2">
                    <TrainingFileDropzone
                      label="Scan or filled file"
                      required
                      accept={ACCEPT}
                      maxMb={20}
                      hint="PDF, picture or Office file, max 20 MB."
                      file={sending.evidence?.file ?? evidence.file}
                      uploading={
                        sending.evidence
                          ? { percent: sending.evidence.percent }
                          : undefined
                      }
                      onChange={(f) => setEvidence({ ...evidence, file: f })}
                    />
                  </div>
                  <FormField label="Type" required>
                    <Select
                      value={evidence.kind}
                      enableSearch={false}
                      onChange={(v) => setEvidence({ ...evidence, kind: v })}
                      options={Object.entries(KIND_LABEL).map(
                        ([value, label]) => ({ label, value }),
                      )}
                    />
                  </FormField>
                  <FormField label="For one person (optional)">
                    <Select
                      value={evidence.participantId}
                      onChange={(v) =>
                        setEvidence({ ...evidence, participantId: v })
                      }
                      options={[
                        { label: "The whole session", value: "" },
                        ...participants.map((p) => ({
                          label: p.fullName,
                          value: p.id,
                        })),
                      ]}
                    />
                  </FormField>
                  <FormField label="Paper copy it is the scan of (optional)">
                    <Select
                      value={evidence.packId}
                      onChange={(v) => setEvidence({ ...evidence, packId: v })}
                      options={[
                        { label: "Not a numbered copy", value: "" },
                        ...packs.map((p) => ({ label: `${p.packCode}${p.packKind === "EXAM" ? " (exam)" : ""}`, value: p.id })),
                      ]}
                    />
                  </FormField>
                  <FormField label="Form and version used (optional)">
                    <Input
                      value={evidence.formUsed}
                      maxLength={80}
                      placeholder="For example APD.0009 2.0.0"
                      onChange={(e) =>
                        setEvidence({ ...evidence, formUsed: e.target.value })
                      }
                    />
                  </FormField>
                  <div className="md:col-span-2">
                    <FormField label="Remark">
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
                <p className="text-xs text-slate-500">A second person checks each scan against the paper.</p>
                <div>
                  <Button
                    size="sm"
                    variant="outline-emerald"
                    loading={!!sending.evidence}
                    disabled={!evidence.file}
                    onClick={() => void addEvidence()}
                  >
                    Upload
                  </Button>
                </div>
              </div>
            )}
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
          )}
        </>
      )}
      {part === "materials" && (
        <>
          <TrainingMaterialsBoard
            layout={materialsLayout}
            items={files.materials.filter((m) => m.purpose === "CONTENT").map(toItem)}
            canAdd={canAddMaterial}
            canRemove={canAddMaterial}
            lockedNote={!canAddMaterial && materialsNeeded && files.materials.some((m) => m.purpose === "CONTENT") ? "Materials can be added or removed in the planning step, until the content is reviewed. You can still open them here." : undefined}
            emptyText={
              note ??
              (materialsNeeded
                ? "No material yet. A file (PDF, slides, video) or a link can be added until the content is reviewed."
                : "No material is needed for this training.")
            }
            busy={busy}
            sending={sending.material}
            onAddFile={(file, title) =>
              upload("material", file, (onProgress) => trainingFilesApi.uploadMaterial(activityId, file, title || undefined, "CONTENT", onProgress), "File added")
            }
            onAddLink={(title, url) => run(() => trainingFilesApi.addLink(activityId, title, url), "Link added")}
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
              Download
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
                View Specimen Signature
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
                I checked it against the paper
              </DropdownMenuItem>
            )}
          </div>
        )}
      </PortalDropdownMenu>

      {specimenOf && <SpecimenViewModal personId={specimenOf.personId} personName={specimenOf.name} onClose={() => setSpecimenOf(undefined)} />}
      <FormModal
        isOpen={!!removing}
        onClose={() => setRemoving(undefined)}
        title="Remove File"
        description="The file stays on record, marked as removed with your reason."
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
        <FormField label="Reason" required>
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
