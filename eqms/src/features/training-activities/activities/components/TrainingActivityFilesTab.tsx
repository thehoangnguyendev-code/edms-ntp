import { useCallback, useEffect, useState } from "react";
import { CloudUpload, Eye, Link2, Lock } from "lucide-react";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "../../shared/TrainingFields";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingError, trainingFilesApi, type TrainingActivityFiles, type TrainingMaterial, type TrainingPaperEvidence, type TrainingParticipant } from "@/services/api/trainingActivities";
import { day, when } from "../../shared/trainingLabels";
import { TrainingFileDropzone } from "../../shared/TrainingFileDropzone";
import { TabBlock } from "../../shared/TrainingDetailLayout";
import type { ActivityMode } from "../TrainingActivityDetailPage";

const KIND_LABEL: Record<string, string> = { ATTENDANCE_SHEET: "Attendance sheet", ASSESSMENT: "Test or checklist", CERTIFICATE: "Certificate", OTHER: "Other" };
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.pptx";
const MATERIAL_ACCEPT = `${ACCEPT},.mp4`;
const size = (bytes: number) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function save(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

type Sending = { file: File; percent: number };
const EMPTY_EVIDENCE = { file: null as File | null, kind: "ATTENDANCE_SHEET", participantId: "", remark: "" };

/**
 * The files of an activity: the materials (file or link), the exam and the answer key, and the scans of what was signed on paper. Each file has a fingerprint and is never
 * changed or deleted. Materials and the exam are added in the Edit screen, the scans in the Conduct screen; every other screen only looks.
 */
export function TrainingActivityFilesTab({ activityId, participants, part, mode, external = false }: { activityId: string; participants: TrainingParticipant[]; part: "materials" | "assessment"; mode: ActivityMode; external?: boolean }) {
  const { showToast } = useToast();
  const [files, setFiles] = useState<TrainingActivityFiles>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<Record<string, Sending | undefined>>({});
  const [material, setMaterial] = useState<{ mode: "file" | "link"; file: File | null; title: string; url: string }>({ mode: "file", file: null, title: "", url: "" });
  const [evidence, setEvidence] = useState(EMPTY_EVIDENCE);
  const [removing, setRemoving] = useState<{ id: string; reason: string }>();

  const load = useCallback(() => {
    trainingFilesApi.list(activityId).then(setFiles).catch((e) => setError(trainingError(e)));
  }, [activityId]);
  useEffect(load, [load]);

  const run = async (action: () => Promise<TrainingActivityFiles>, done: string) => {
    setBusy(true);
    try {
      setFiles(await action());
      showToast({ type: "success", title: done, message: "" });
      return true;
    } catch (e) {
      showToast({ type: "error", title: "The action was not done", message: trainingError(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  /** An upload with its progress (0 to 100) shown on the file card of `slot`. */
  const upload = async (slot: string, file: File, send: (onProgress: (percent: number) => void) => Promise<TrainingActivityFiles>, done: string) => {
    setSending((old) => ({ ...old, [slot]: { file, percent: 0 } }));
    try {
      setFiles(await send((percent) => setSending((old) => ({ ...old, [slot]: { file, percent } }))));
      showToast({ type: "success", title: done, message: "" });
      return true;
    } catch (e) {
      showToast({ type: "error", title: "The file was not uploaded", message: trainingError(e) });
      return false;
    } finally {
      setSending((old) => ({ ...old, [slot]: undefined }));
    }
  };
  const download = async (fetcher: () => Promise<Blob>, name: string) => {
    try {
      save(await fetcher(), name);
    } catch (e) {
      showToast({ type: "error", title: "The file could not be downloaded", message: trainingError(e) });
    }
  };
  /** Opens the file in a new tab: a PDF in the project PDF viewer, a Word file in the OnlyOffice viewer. Nothing is converted. */
  const previewType = (name?: string | null) => (name?.toLowerCase().endsWith(".pdf") ? "pdf" : name?.toLowerCase().endsWith(".docx") ? "docx" : null);
  const preview = (id: string, name?: string | null) => {
    const type = previewType(name);
    if (type) window.open(`/training-management/materials/${id}/preview?type=${type}`, "_blank", "noopener");
  };

  if (!files) return error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <SectionLoading text="Loading files…" />;

  const canAddMaterial = mode === "edit" && files.canUploadMaterial;
  const canAddEvidence = mode === "conduct" && files.canUploadEvidence;
  const canReceive = mode === "conduct" && files.canReceive;

  const materialColumns: DataTableColumn<TrainingMaterial>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "title", header: "Title", cell: (m) => <div className="max-w-80 whitespace-normal">{m.title}{m.removedAt ? <div className="text-xs text-red-700">Removed {day(m.removedAt)}: {m.removeReason}</div> : null}</div> },
    { id: "file", header: "File or link", cell: (m) => (m.linkUrl ? <div className="max-w-80 whitespace-normal"><a href={m.linkUrl} target="_blank" rel="noopener noreferrer" className="break-all text-emerald-600 hover:underline">{m.linkUrl}</a> <Badge color="amber" size="sm">Link, not a controlled file</Badge></div> : `${m.originalName} (${size(m.sizeBytes ?? 0)})`) },
    { id: "by", header: "Uploaded by", cell: (m) => `${m.uploadedByName} (${day(m.createdAt)})` },
    { id: "sha", header: "SHA-256", cell: (m) => (m.sha256 ? <span className="break-all font-mono text-xs">{m.sha256.slice(0, 16)}…</span> : "—") },
    {
      id: "actions",
      header: "",
      cell: (m) => (
        <div className="flex flex-wrap items-center gap-2">
          {m.linkUrl ? (
            <Button size="sm" variant="outline" onClick={() => window.open(m.linkUrl as string, "_blank", "noopener,noreferrer")}>Open</Button>
          ) : (
            <>
              {previewType(m.originalName) && <Button size="icon-sm" variant="ghost" title="Preview in a new tab" aria-label="Preview in a new tab" onClick={() => preview(m.id, m.originalName)}><Eye className="h-4 w-4" /></Button>}
              <Button size="sm" variant="outline" onClick={() => void download(() => trainingFilesApi.downloadMaterial(m.id), m.originalName ?? "file")}>Download</Button>
            </>
          )}
          {canAddMaterial && !m.removedAt && <Button size="sm" variant="outline" onClick={() => setRemoving({ id: m.id, reason: "" })}>Remove</Button>}
        </div>
      ),
    },
  ];
  const evidenceColumns: DataTableColumn<TrainingPaperEvidence>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "kind", header: "Type", cell: (e) => KIND_LABEL[e.kind] ?? e.kind },
    { id: "file", header: "File", cell: (e) => `${e.originalName} (${size(e.sizeBytes)})` },
    { id: "person", header: "For", cell: (e) => e.participantName ?? "The whole session" },
    { id: "by", header: "Uploaded by", cell: (e) => `${e.uploadedByName} (${day(e.uploadedAt)})` },
    { id: "received", header: "Checked against the paper", cell: (e) => (e.receivedAt ? <Badge color="emerald">{e.receivedByName}, {when(e.receivedAt)}</Badge> : <Badge color="amber">Not yet</Badge>) },
    { id: "remark", header: "Remark", cell: (e) => <div className="max-w-60 whitespace-normal">{e.remark ?? "—"}</div> },
    {
      id: "actions",
      header: "",
      cell: (e) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void download(() => trainingFilesApi.downloadEvidence(e.id), e.originalName)}>Download</Button>
          {canReceive && !e.receivedAt && <Button size="sm" variant="outline-emerald" onClick={() => void run(() => trainingFilesApi.receiveEvidence(e.id), "Scan received")}>I checked it against the paper</Button>}
        </div>
      ),
    },
  ];

  const slotOf = (purpose: "EXAM" | "ANSWER_KEY") => files.materials.find((m) => m.purpose === purpose && !m.removedAt);
  const assessmentZone = (purpose: "EXAM" | "ANSWER_KEY") => {
    const current = slotOf(purpose);
    const isKey = purpose === "ANSWER_KEY";
    const active = sending[purpose];
    return (
      <TrainingFileDropzone
        label={isKey ? "Answer Key (Optional)" : "Exam Template"}
        description={isKey ? "Upload the answer key for grading reference. Only visible to the organizers and to the people who review or approve the content." : "Upload the exam or quiz paper (Word or PDF) that will be printed and given to the employees."}
        accept=".pdf,.docx"
        maxMb={20}
        hint="Word or PDF (max 20 MB)"
        file={active?.file ?? null}
        uploading={active ? { percent: active.percent } : undefined}
        disabled={busy || !!active}
        badge={isKey ? <Badge color="amber" size="sm" pill icon={<Lock className="h-3 w-3" />}>Organizers / Reviewers only</Badge> : undefined}
        existing={!active && current ? {
          name: current.originalName ?? "file", size: current.sizeBytes ?? 0, note: `${current.uploadedByName}, ${day(current.createdAt)}`,
          onPreview: previewType(current.originalName) ? () => preview(current.id, current.originalName) : undefined,
          onDownload: () => void download(() => trainingFilesApi.downloadMaterial(current.id), current.originalName ?? "file"),
          onRemove: canAddMaterial ? () => setRemoving({ id: current.id, reason: "" }) : undefined,
        } : undefined}
        readOnlyText={!active && !current && !canAddMaterial ? "No file." : undefined}
        onChange={(f) => { if (f) void upload(purpose, f, (onProgress) => trainingFilesApi.uploadMaterial(activityId, f, undefined, purpose, onProgress), isKey ? "Answer key added" : "Exam template added"); }}
      />
    );
  };

  const addMaterial = async () => {
    const ok = material.mode === "link"
      ? await run(() => trainingFilesApi.addLink(activityId, material.title.trim(), material.url.trim()), "Link added")
      : await upload("material", material.file as File, (onProgress) => trainingFilesApi.uploadMaterial(activityId, material.file as File, material.title.trim() || undefined, "CONTENT", onProgress), "File added");
    if (ok) setMaterial({ mode: material.mode, file: null, title: "", url: "" });
  };
  const materialReady = material.mode === "link" ? /^https:\/\/\S+$/i.test(material.url.trim()) : !!material.file;
  const addEvidence = async () => {
    const e = evidence;
    if (!e.file) return;
    const ok = await upload("evidence", e.file, (onProgress) => trainingFilesApi.uploadEvidence(activityId, e.file as File, e.kind, e.participantId || undefined, e.remark.trim() || undefined, onProgress), "Scan uploaded");
    if (ok) setEvidence(EMPTY_EVIDENCE);
  };

  return (
    <div className="space-y-6">
      {part === "assessment" && (
        <>
          {external && <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-sm text-slate-600">An external training has no exam of its own. Upload the certificate or the attendance proof of the training unit below.</p>}
          {!external && <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Assessment Materials</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              {assessmentZone("EXAM")}
              {files.canSeeAnswerKey && assessmentZone("ANSWER_KEY")}
            </div>
          </div>}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">Paper evidence</h3>
            {canAddEvidence && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                  <div className="md:col-span-2">
                    <TrainingFileDropzone label="Scan" required accept={ACCEPT} maxMb={20} hint="PDF, picture or Office file (max 20 MB)" file={sending.evidence?.file ?? evidence.file}
                      uploading={sending.evidence ? { percent: sending.evidence.percent } : undefined} onChange={(f) => setEvidence({ ...evidence, file: f })} />
                  </div>
                  <FormField label="Type" required><Select value={evidence.kind} enableSearch={false} onChange={(v) => setEvidence({ ...evidence, kind: v })} options={Object.entries(KIND_LABEL).map(([value, label]) => ({ label, value }))} /></FormField>
                  <FormField label="For one person (optional)"><Select value={evidence.participantId} onChange={(v) => setEvidence({ ...evidence, participantId: v })} options={[{ label: "The whole session", value: "" }, ...participants.map((p) => ({ label: p.fullName, value: p.id }))]} /></FormField>
                  <div className="md:col-span-2"><FormField label="Remark"><Textarea rows={2} value={evidence.remark} onChange={(e) => setEvidence({ ...evidence, remark: e.target.value })} /></FormField></div>
                </div>
                <p className="text-xs text-slate-500">A second person checks the scan against the paper. When it belongs to one person, receiving it records that person's paper signature.</p>
                <div><Button size="sm" variant="outline-emerald" loading={!!sending.evidence} disabled={!evidence.file} onClick={() => void addEvidence()}>Upload scan</Button></div>
              </div>
            )}
            <TabBlock>
              <DataTable rows={files.evidence} getRowKey={(e) => e.id} columns={evidenceColumns} emptyState={<p className="p-4 text-sm text-slate-500">No scan yet. Sheets and tests signed by hand are uploaded here and checked against the paper by a second person.</p>} />
            </TabBlock>
          </div>
        </>
      )}
      {part === "materials" && (
        <>
          {canAddMaterial && (
            <div className="space-y-4">
              <TabNav tabs={[{ id: "file", label: "Upload file", icon: CloudUpload }, { id: "link", label: "Link (for example YouTube)", icon: Link2 }]} activeTab={material.mode} onChange={(id) => setMaterial({ ...material, mode: id as "file" | "link" })} variant="pill" layoutId="training-material-mode" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                <div className="md:col-span-2">
                  {material.mode === "file" ? (
                    <TrainingFileDropzone label="File" required accept={MATERIAL_ACCEPT} maxMb={material.file?.name.toLowerCase().endsWith(".mp4") ? 100 : 20} hint="PDF, picture, Office file (max 20 MB) or MP4 video (max 100 MB)"
                      file={sending.material?.file ?? material.file} uploading={sending.material ? { percent: sending.material.percent } : undefined} onChange={(f) => setMaterial({ ...material, file: f })} />
                  ) : (
                    <div className="space-y-1">
                      <FormField label="Address" required><Input value={material.url} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => setMaterial({ ...material, url: e.target.value })} /></FormField>
                      <p className="text-xs text-amber-700">A link is not stored or fingerprinted. The page it points to can change after the content is approved.</p>
                    </div>
                  )}
                </div>
                <div className="md:col-span-2"><FormField label="Title"><Input value={material.title} maxLength={255} placeholder="Shown in the list of materials" onChange={(e) => setMaterial({ ...material, title: e.target.value })} /></FormField></div>
              </div>
              <div><Button size="sm" variant="outline-emerald" loading={busy || !!sending.material} disabled={!materialReady} onClick={() => void addMaterial()}>Add material</Button></div>
            </div>
          )}
          <TabBlock title="Training Materials">
            <DataTable rows={files.materials.filter((m) => m.purpose === "CONTENT")} getRowKey={(m) => m.id} columns={materialColumns} emptyState={<p className="p-4 text-sm text-slate-500">No material yet. A file (PDF, slides, video) or a link can be added until the content is reviewed.</p>} />
          </TabBlock>
        </>
      )}

      <FormModal isOpen={!!removing} onClose={() => setRemoving(undefined)} title="Remove file" description="The file stays on record, marked as removed with your reason." confirmText="Remove" confirmVariant="destructive" isLoading={busy} confirmDisabled={!removing?.reason.trim()} size="md"
        onConfirm={async () => { if (removing && (await run(() => trainingFilesApi.removeMaterial(removing.id, removing.reason.trim()), "File removed"))) setRemoving(undefined); }}>
        <FormField label="Reason" required><Textarea rows={3} value={removing?.reason ?? ""} onChange={(e) => removing && setRemoving({ ...removing, reason: e.target.value })} /></FormField>
      </FormModal>
    </div>
  );
}
