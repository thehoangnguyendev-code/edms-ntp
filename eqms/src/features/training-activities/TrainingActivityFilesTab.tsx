import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingError, trainingFilesApi, type TrainingActivityFiles, type TrainingMaterial, type TrainingPaperEvidence, type TrainingParticipant } from "@/services/api/trainingActivities";
import { day, when } from "./trainingLabels";

const KIND_LABEL: Record<string, string> = { ATTENDANCE_SHEET: "Attendance sheet", ASSESSMENT: "Test or checklist", OTHER: "Other" };
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.pptx";
const size = (bytes: number) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function save(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** The files of an activity: the content and the test, and the scans of what was signed on paper. Each file has a fingerprint and is never changed or deleted. */
export function TrainingActivityFilesTab({ activityId, participants }: { activityId: string; participants: TrainingParticipant[] }) {
  const { showToast } = useToast();
  const [files, setFiles] = useState<TrainingActivityFiles>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [material, setMaterial] = useState<{ file: File | null; title: string }>();
  const [evidence, setEvidence] = useState<{ file: File | null; kind: string; participantId: string; remark: string }>();
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
  const download = async (fetcher: () => Promise<Blob>, name: string) => {
    try {
      save(await fetcher(), name);
    } catch (e) {
      showToast({ type: "error", title: "The file could not be downloaded", message: trainingError(e) });
    }
  };

  if (!files) return error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <SectionLoading text="Loading files…" />;

  const materialColumns: DataTableColumn<TrainingMaterial>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "title", header: "Title", cell: (m) => <div className="max-w-80 whitespace-normal">{m.title}{m.removedAt ? <div className="text-xs text-red-700">Removed {day(m.removedAt)}: {m.removeReason}</div> : null}</div> },
    { id: "file", header: "File", cell: (m) => `${m.originalName} (${size(m.sizeBytes)})` },
    { id: "by", header: "Uploaded by", cell: (m) => `${m.uploadedByName} (${day(m.createdAt)})` },
    { id: "sha", header: "SHA-256", cell: (m) => <span className="break-all font-mono text-xs">{m.sha256.slice(0, 16)}…</span> },
    {
      id: "actions",
      header: "",
      cell: (m) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void download(() => trainingFilesApi.downloadMaterial(m.id), m.originalName)}>Download</Button>
          {files.canUploadMaterial && !m.removedAt && <Button size="sm" variant="outline" onClick={() => setRemoving({ id: m.id, reason: "" })}>Remove</Button>}
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
          {files.canReceive && !e.receivedAt && <Button size="sm" variant="outline-emerald" onClick={() => void run(() => trainingFilesApi.receiveEvidence(e.id), "Scan received")}>I checked it against the paper</Button>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <FormSection title="Training content and test" headerRight={files.canUploadMaterial ? <Button size="sm" onClick={() => setMaterial({ file: null, title: "" })}>Add file</Button> : undefined}>
        <DataTable rows={files.materials} getRowKey={(m) => m.id} columns={materialColumns} emptyState={<p className="p-4 text-sm text-slate-500">No file yet. Files can be added until the content is reviewed.</p>} />
      </FormSection>
      <FormSection title="Paper evidence" headerRight={files.canUploadEvidence ? <Button size="sm" onClick={() => setEvidence({ file: null, kind: "ATTENDANCE_SHEET", participantId: "", remark: "" })}>Upload scan</Button> : undefined}>
        <DataTable rows={files.evidence} getRowKey={(e) => e.id} columns={evidenceColumns} emptyState={<p className="p-4 text-sm text-slate-500">No scan yet. Sheets and tests signed by hand are uploaded here and checked against the paper by a second person.</p>} />
      </FormSection>

      <FormModal isOpen={!!material} onClose={() => setMaterial(undefined)} title="Add a file" description="PDF, picture or Office file up to 20 MB. It is scanned for malware and fingerprinted." confirmText="Upload" isLoading={busy} confirmDisabled={!material?.file} size="md"
        onConfirm={async () => { if (material?.file && (await run(() => trainingFilesApi.uploadMaterial(activityId, material.file as File, material.title.trim() || undefined), "File added"))) setMaterial(undefined); }}>
        {material && (
          <div className="grid gap-4">
            <FormField label="File" required><input type="file" accept={ACCEPT} onChange={(e) => setMaterial({ ...material, file: e.target.files?.[0] ?? null })} /></FormField>
            <FormField label="Title"><Input value={material.title} maxLength={255} onChange={(e) => setMaterial({ ...material, title: e.target.value })} /></FormField>
          </div>
        )}
      </FormModal>
      <FormModal isOpen={!!evidence} onClose={() => setEvidence(undefined)} title="Upload a scan" description="A second person checks the scan against the paper. When it belongs to one person, receiving it records that person's paper signature." confirmText="Upload" isLoading={busy} confirmDisabled={!evidence?.file} size="md"
        onConfirm={async () => { if (evidence?.file && (await run(() => trainingFilesApi.uploadEvidence(activityId, evidence.file as File, evidence.kind, evidence.participantId || undefined, evidence.remark.trim() || undefined), "Scan uploaded"))) setEvidence(undefined); }}>
        {evidence && (
          <div className="grid gap-4">
            <FormField label="File" required><input type="file" accept={ACCEPT} onChange={(e) => setEvidence({ ...evidence, file: e.target.files?.[0] ?? null })} /></FormField>
            <FormField label="Type" required><Select value={evidence.kind} enableSearch={false} onChange={(v) => setEvidence({ ...evidence, kind: v })} options={Object.entries(KIND_LABEL).map(([value, label]) => ({ label, value }))} /></FormField>
            <FormField label="For one person (optional)"><Select value={evidence.participantId} onChange={(v) => setEvidence({ ...evidence, participantId: v })} options={[{ label: "The whole session", value: "" }, ...participants.map((p) => ({ label: p.fullName, value: p.id }))]} /></FormField>
            <FormField label="Remark"><Textarea rows={2} value={evidence.remark} onChange={(e) => setEvidence({ ...evidence, remark: e.target.value })} /></FormField>
          </div>
        )}
      </FormModal>
      <FormModal isOpen={!!removing} onClose={() => setRemoving(undefined)} title="Remove file" description="The file stays on record, marked as removed with your reason." confirmText="Remove" confirmVariant="destructive" isLoading={busy} confirmDisabled={!removing?.reason.trim()} size="md"
        onConfirm={async () => { if (removing && (await run(() => trainingFilesApi.removeMaterial(removing.id, removing.reason.trim()), "File removed"))) setRemoving(undefined); }}>
        <FormField label="Reason" required><Textarea rows={3} value={removing?.reason ?? ""} onChange={(e) => removing && setRemoving({ ...removing, reason: e.target.value })} /></FormField>
      </FormModal>
    </div>
  );
}
