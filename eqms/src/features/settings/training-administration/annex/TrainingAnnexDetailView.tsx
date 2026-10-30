import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, Layers3, ListChecks, PenLine, SearchCheck } from "lucide-react";
import { IconDownload, IconEye, IconFileTypeDocx, IconFileTypePdf, IconPlus, IconRefresh } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { trainingAnnexDetail } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { OnlyOfficeDocumentViewer } from "@/features/documents/shared/components/OnlyOfficeDocumentViewer";
import { Input, Textarea } from "@/features/training-activities/shared/TrainingFields";
import { TrainingFileDropzone } from "@/features/training-activities/shared/TrainingFileDropzone";
import { saveBlob, when } from "@/features/training-activities/shared/trainingLabels";
import {
  trainingAnnexApi,
  trainingError,
  trainingFormTemplatesApi,
  type TrainingAnnexDetail,
  type TrainingAnnexSlot,
  type TrainingFormTemplate,
} from "@/services/api/trainingActivities";
import { TokenCheckBadge } from "./TokenCheckBadge";

const STATUS_LABEL = { ENABLED: "Enabled", DISABLED: "Disabled" } as const;
const STYLE_OPTIONS = [
  { label: "Compact (default)", value: "" },
  { label: "Compact", value: "COMPACT" },
  { label: "Standard", value: "STANDARD" },
  { label: "Detailed", value: "DETAILED" },
];
const STYLE_LABEL: Record<string, string> = { COMPACT: "Compact", STANDARD: "Standard", DETAILED: "Detailed" };
const STYLE_HINT: Record<string, string> = {
  COMPACT: "Name, then the meaning and the date and time on one line. For a narrow cell.",
  STANDARD: "Name, “Electronically” and the meaning, then the date and time. For a signature area of its own.",
  DETAILED: "Name, the meaning and the date and time to the second, then the Signature ID. For an important record.",
};

/** The code of the form as Document Control writes it: APD.0024 with the revision 2.0.0 is APD.0024.02. */
const fullCode = (code: string, revision: string) => {
  const m = /^\s*(\d{1,3})(\.\d+){0,2}\s*$/.exec(revision);
  return m ? `${code}.${m[1].padStart(2, "0")}` : code;
};

/** A section of the left column that opens and closes, so the page stays short. */
function Fold({ title, icon, open, onToggle, children, headerRight }: { title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode; headerRight?: React.ReactNode }) {
  return (
    <FormSection title={title} icon={icon} headerRight={<div className="flex items-center gap-2">{headerRight}<button type="button" aria-label={`${open ? "Collapse" : "Expand"} ${title}`} aria-expanded={open} onClick={onToggle} className="rounded p-1 text-slate-500 hover:bg-slate-100"><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></button></div>}>
      {open ? children : null}
    </FormSection>
  );
}

/**
 * One form of the Training Annex, on one page like the Publishing Workspace: on the left the version of the template and what to do with it, what the check found, how each electronic
 * signature is shown and the tokens that can be written in the Word file; on the right the preview of the chosen version with sample data. The system fixes what the form holds; the person
 * writes the tokens in Word, uploads the file, reads the check and the preview, and enables it with an electronic signature.
 */
export function TrainingAnnexDetailView({ mode = "view" }: { mode?: "view" | "edit" }) {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  // "view" only reads; "edit" uploads templates and chooses the style of each signature. Putting a version in force and taking it out of use are done from the list.
  const canManage = mode === "edit" && hasPermission("training.annex.manage");
  const editing = mode === "edit";

  const [detail, setDetail] = useState<TrainingAnnexDetail>();
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upload, setUpload] = useState({ file: null as File | null, versionLabel: "", remark: "" });
  const [viewing, setViewing] = useState(false);
  const [styling, setStyling] = useState<{ slot: TrainingAnnexSlot; style: string; reason: string }>();
  const [open, setOpen] = useState({ check: true, signatures: true, tokens: false });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const previewOf = useRef("");

  const load = useCallback((keep?: string) => {
    trainingAnnexApi.detail(code).then((d) => {
      setDetail(d);
      setError("");
      setSelectedId((current) => {
        const wanted = keep ?? current;
        return d.templates.some((t) => t.id === wanted) ? wanted : (d.templates.find((t) => t.status === "ENABLED") ?? d.templates[0])?.id ?? "";
      });
    }).catch((e) => setError(trainingError(e)));
  }, [code]);
  useEffect(() => { load(); }, [load]);

  const selected: TrainingFormTemplate | undefined = detail?.templates.find((t) => t.id === selectedId);
  const contract = detail?.contract;

  const makePreview = useCallback(async (template: TrainingFormTemplate | undefined) => {
    if (!template || template.tokenMode !== "TOKENS" || template.checkProblems) {
      setPreviewUrl(null);
      setPreviewError("");
      previewOf.current = "";
      return;
    }
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const url = URL.createObjectURL(await trainingAnnexApi.preview(template.id));
      previewOf.current = template.id;
      setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
    } catch (e) {
      setPreviewUrl(null);
      setPreviewError(trainingError(e));
    } finally {
      setPreviewLoading(false);
    }
  }, []);
  // the preview follows the version that is chosen
  useEffect(() => { if (selected && previewOf.current !== selected.id) void makePreview(selected); if (!selected) void makePreview(undefined); }, [selected, makePreview]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const versionOptions = useMemo(
    () => (detail?.templates ?? []).map((t) => ({ value: t.id, label: `${t.versionLabel} · ${fullCode(code, t.versionLabel)}${t.status === "ENABLED" ? " (enabled)" : ""}` })),
    [detail],
  );

  const run = async (action: () => Promise<unknown>, done: { title: string; message?: string }, failTitle: string) => {
    setBusy(true);
    try {
      await action();
      showToast({ type: "success", title: done.title, message: done.message ?? "" });
      return true;
    } catch (e) {
      showToast({ type: "error", title: failTitle, message: trainingError(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const doUpload = async () => {
    if (!upload.file || !detail) return;
    let created: TrainingFormTemplate | undefined;
    const ok = await run(async () => {
      created = await trainingFormTemplatesApi.upload(upload.file as File, { code, title: detail.title, versionLabel: upload.versionLabel.trim(), remark: upload.remark.trim() || undefined });
    }, { title: "Template uploaded", message: "Read the check below. It is used only after you enable it." }, "The template was not uploaded");
    if (ok) {
      setUploadOpen(false);
      setUpload({ file: null, versionLabel: "", remark: "" });
      previewOf.current = "";
      load(created?.id);
    }
  };
  const doStyle = async () => {
    if (!styling) return;
    const ok = await run(() => trainingAnnexApi.setStyle(code, styling.slot.name, styling.style, styling.reason.trim()),
      { title: "Signature style saved", message: `${styling.slot.name}: ${STYLE_LABEL[styling.style]}` }, "The style was not saved");
    if (ok) { setStyling(undefined); load(); }
  };
  const download = async (kind: "template" | "starter") => {
    try {
      if (kind === "starter") saveBlob(await trainingAnnexApi.starter(code), `${code}-tokenized-starter.docx`);
      else if (selected) saveBlob(await trainingFormTemplatesApi.download(selected.id), selected.originalName);
    } catch (e) {
      showToast({ type: "error", title: "The file was not downloaded", message: trainingError(e) });
    }
  };
  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      showToast({ type: "success", title: "Copied", message: token });
    } catch {
      showToast({ type: "error", title: "Could not copy", message: token });
    }
  };

  if (error && !detail) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!detail || !contract) return <SectionLoading text="Loading…" />;
  const toggle = (key: keyof typeof open) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  const checked = contract.checked;
  const problems = selected?.checkProblems ? selected.checkProblems.split("\n") : [];
  const token = (n: string) => `{{${n}}}`;
  const Chip = ({ text }: { text: string }) => (
    <button type="button" title="Click to copy" onClick={() => void copy(text)} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800 hover:bg-emerald-100">{text}</button>
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader
        title={editing ? "Edit Training Annex" : "Training Annex Details"}
        breadcrumbItems={trainingAnnexDetail(navigate, code, editing ? "Edit Training Annex" : "Training Annex Details")}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => navigate(ROUTES.SETTINGS.TRAINING_ADMINISTRATION.ANNEX)}>Back</Button>
            {checked && detail.starterAvailable && <Button size="sm" variant="outline-emerald" className="gap-2 whitespace-nowrap" onClick={() => void download("starter")}><IconDownload className="h-4 w-4" />Download Starter File</Button>}
            {canManage && <Button size="sm" variant="outline-emerald" className="gap-2 whitespace-nowrap" onClick={() => setUploadOpen(true)}><IconPlus className="h-4 w-4" />Upload Template</Button>}
          </div>
        )}
      />

      {editing && (
        <ol className="grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 sm:grid-cols-2 xl:grid-cols-5" aria-label="How to update this form">
          {[
            ["1", "Download the starter file", "It holds the form with its tokens."],
            ["2", "Change it in Word", "Keep the tokens; change the wording and the look."],
            ["3", "Upload it as a new version", "It is checked at once."],
            ["4", "Read Check and Preview", "Fix the Word file if the check finds a problem."],
            ["5", "Enable it from the list", "Enable Training Annex, with your signature."],
          ].map(([n, title, hint]) => (
            <li key={n} className="flex gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">{n}</span><span><span className="font-medium">{title}</span><br /><span className="text-xs text-emerald-800">{hint}</span></span></li>
          ))}
        </ol>
      )}

      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)] xl:gap-6">
        <div className="space-y-4">
          <FormSection title="Template" icon={<Layers3 className="h-4 w-4" />}>
            {detail.templates.length === 0 ? (
              <p className="text-sm text-slate-600">No template is uploaded for this form. {checked ? "Download the starter file, write your wording around the tokens in Word, and upload it." : "Upload the Word file of the form."}</p>
            ) : (
              <div className="space-y-3">
                <FormField label="Version">
                  <Select value={selectedId} options={versionOptions} onChange={(v) => setSelectedId(String(v))} aria-label="Template version" />
                </FormField>
                {selected && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color={selected.status === "ENABLED" ? "emerald" : "slate"}>{STATUS_LABEL[selected.status]}</Badge>
                      <TokenCheckBadge template={selected} />
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <IconFileTypeDocx className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-slate-900">{selected.originalName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {selected.sizeBytes >= 1048576 ? `${(selected.sizeBytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(selected.sizeBytes / 1024))} KB`}
                          <span className="mx-1.5">·</span>
                          <span className="font-mono" title={selected.sha256}>SHA-256 {selected.sha256.slice(0, 8)}…{selected.sha256.slice(-6)}</span>
                        </p>
                      </div>
                    </div>
                    <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
                      {[
                        { key: "up", label: "Uploaded", dot: "bg-slate-400", by: selected.uploadedByName, at: selected.uploadedAt },
                        ...(selected.enabledAt ? [{ key: "en", label: "Enabled", dot: "bg-emerald-500", by: selected.enabledByName, at: selected.enabledAt }] : []),
                        ...(selected.disabledAt ? [{ key: "di", label: "Disabled", dot: "bg-amber-500", by: selected.disabledByName, at: selected.disabledAt }] : []),
                      ].map((e) => (
                        <li key={e.key} className="relative">
                          <span className={`absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${e.dot}`} />
                          <p className="text-sm font-medium text-slate-800">{e.label}</p>
                          <p className="text-xs text-slate-500">{e.by ?? "—"} · {when(e.at)}</p>
                        </li>
                      ))}
                    </ol>
                    {selected.disableReason && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs font-medium text-amber-800">Reason for disabling</p>
                        <p className="mt-0.5 text-sm text-amber-900">{selected.disableReason}</p>
                      </div>
                    )}
                    {selected.remark && (
                      <div>
                        <p className="text-xs font-medium text-slate-500">Remark</p>
                        <p className="mt-0.5 text-sm text-slate-800">{selected.remark}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline-emerald" className="gap-2" onClick={() => setViewing(true)}><IconEye className="h-4 w-4" />View File</Button>
                      <Button size="sm" variant="outline-emerald" className="gap-2" onClick={() => void download("template")}><IconDownload className="h-4 w-4" />Download</Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </FormSection>

          {detail.templates.length > 1 && (
            <FormSection title="All Versions" icon={<Layers3 className="h-4 w-4" />}>
              <ul className="divide-y divide-slate-100">
                {detail.templates.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => setSelectedId(t.id)} aria-current={t.id === selectedId} className={`flex w-full items-center justify-between gap-2 py-2 text-left text-sm hover:bg-slate-50 ${t.id === selectedId ? "font-medium text-emerald-800" : "text-slate-800"}`}>
                      <span className="min-w-0 truncate">{t.versionLabel}<span className="ml-2 text-xs font-normal text-slate-500">{when(t.uploadedAt)}</span></span>
                      <span className="flex shrink-0 items-center gap-1.5"><Badge color={t.status === "ENABLED" ? "emerald" : "slate"}>{STATUS_LABEL[t.status]}</Badge><TokenCheckBadge template={t} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            </FormSection>
          )}

          {selected && (
            <Fold title="Check" icon={<SearchCheck className="h-4 w-4" />} open={open.check} onToggle={() => toggle("check")}>
              {selected.tokenMode === "TOKENS" && problems.length === 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-sm font-medium text-emerald-900">The file agrees with the form</p>
                  <p className="mt-0.5 text-xs text-emerald-800">All required tokens are present, none is unknown and every marker is closed. This version can be enabled from the list.</p>
                </div>
              )}
              {selected.tokenMode === "TOKENS" && problems.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-sm font-medium text-red-900">{problems.length} {problems.length === 1 ? "problem" : "problems"} to fix</p>
                  <p className="mt-0.5 text-xs text-red-800">This version cannot be enabled until these are fixed in the Word file. Upload the corrected file as a new version.</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              )}
              {selected.tokenMode === "LEGACY" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-sm font-medium text-amber-900">Earlier template, tokens not checked</p>
                  <p className="mt-0.5 text-xs text-amber-800">The system finds each place by the words printed in the form, so a changed wording can leave a place empty. It keeps working. To get the check and the preview, download the starter file and upload a version written with tokens.</p>
                </div>
              )}
              {selected.tokenMode === "NOT_APPLICABLE" && <p className="text-sm text-slate-600">This form is built by the assessment builder. Its Word file has no tokens to check.</p>}
              {selected.checkedAt && <p className="mt-2 text-xs text-slate-500">Checked {when(selected.checkedAt)}</p>}
            </Fold>
          )}

          {checked && (
            <Fold title="Electronic Signatures" icon={<PenLine className="h-4 w-4" />} open={open.signatures} onToggle={() => toggle("signatures")}>
              <p className="mb-3 text-xs text-slate-600">Each slot is filled when its stage is reached, in the order below. The style is how much of the signature record is written; Compact is used until another is chosen and applies from the next form made.{editing ? "" : " Choose a style with Edit Training Annex in the list."}</p>
              <ol className="space-y-2">
                {contract.slots.map((s, i) => (
                  <li key={s.name} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.stage}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">{s.meanings.map((m) => <span key={m} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{m}</span>)}</div>
                        <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2.5">
                          <span className="shrink-0 text-xs text-slate-500">Style</span>
                          {canManage ? (
                            <div className="min-w-0 flex-1">
                              <Select
                                value={s.style ?? ""}
                                options={STYLE_OPTIONS}
                                aria-label={`Style of ${s.name}`}
                                onChange={(v) => { const style = String(v); if (style && style !== (s.style ?? "")) setStyling({ slot: s, style, reason: "" }); }}
                              />
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-slate-800">{s.style ? STYLE_LABEL[s.style] : "Compact (default)"}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </Fold>
          )}

          {checked && (
            <Fold title="Tokens for the Word File" icon={<ListChecks className="h-4 w-4" />} open={open.tokens} onToggle={() => toggle("tokens")}>
              <div className="space-y-3 text-xs text-slate-600">
                <p>Write a token where a value goes; click one to copy it. Lines that only describe the form (notes, history of revisions) go between <Chip text="{{#OMIT}}" /> and <Chip text="{{/OMIT}}" />. A table row that holds the tokens of a list is repeated for each item.</p>
                <div><p className="mb-1 font-medium text-slate-800">Facts</p><div className="flex flex-wrap gap-1.5">{[...contract.scalars, "FORM_CODE", "FORM_REVISION", "GENERATED_AT"].map((n) => <Chip key={n} text={token(n)} />)}</div></div>
                {contract.checks.length > 0 && <div><p className="mb-1 font-medium text-slate-800">Boxes</p><div className="flex flex-wrap gap-1.5">{contract.checks.map((n) => <Chip key={n} text={token(`CHECK:${n}`)} />)}</div></div>}
                {contract.groups.map((g) => (
                  <div key={g.name}>
                    <p className="mb-1 font-medium text-slate-800">{g.name}{g.repeatsBlock ? <span className="font-normal text-slate-500"> (a block repeated for each item)</span> : ""}</p>
                    <div className="flex flex-wrap gap-1.5">{g.fields.map((f) => <Chip key={f} text={token(`${g.name}.${f}`)} />)}</div>
                  </div>
                ))}
                {contract.cases.length > 0 && <div><p className="mb-1 font-medium text-slate-800">Cases (the block stays only when the case applies)</p><div className="flex flex-wrap gap-1.5">{contract.cases.map((n) => <Chip key={n} text={token(`#CASE:${n}`)} />)}</div></div>}
                {contract.blocks.length > 0 && <div><p className="mb-1 font-medium text-slate-800">Drawn by the system</p><div className="flex flex-wrap gap-1.5">{contract.blocks.map((n) => <Chip key={n} text={token(`BLOCK:${n}`)} />)}</div></div>}
                <div><p className="mb-1 font-medium text-slate-800">Signatures</p><div className="flex flex-wrap gap-1.5">{contract.slots.map((s) => <Chip key={s.name} text={token(`SIGNATURE:${s.name}`)} />)}</div></div>
              </div>
            </Fold>
          )}
        </div>

        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <FormSection
            title="Preview with Sample Data"
            icon={<IconFileTypePdf className="h-4 w-4" />}
            headerRight={selected?.tokenMode === "TOKENS" && !problems.length ? <Button size="sm" variant="outline-emerald" className="gap-2" disabled={previewLoading} onClick={() => void makePreview(selected)}><IconRefresh className="h-4 w-4" />Regenerate</Button> : undefined}
          >
            {previewUrl ? (
              <div className="overflow-hiddenx bg-white shadow-sm">
                <DocumentPdfViewer fileUrl={previewUrl} height="calc(100vh - 240px)" showThumbnailSidebar={false} isLoading={previewLoading} forceHideDownloadAndPrint allowContextMenu={false} />
              </div>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
                {previewLoading ? <SectionLoading text="Making the preview…" /> : previewError ? <span role="alert" className="text-red-700">{previewError}</span>
                  : !selected ? "Upload a template to see it filled with sample data."
                  : selected.tokenMode !== "TOKENS" ? "Only a template written with tokens can be previewed. Download the starter file and upload a version written with tokens."
                  : "This version does not agree with the form, so it cannot be previewed. Fix the problems in Check."}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">Invented data, marked as not a record. It is not stored and cannot be downloaded or printed.</p>
          </FormSection>
        </div>
      </div>

      {viewing && selected && (
        <FormModal isOpen onClose={() => setViewing(false)} title={`${selected.code} ${selected.versionLabel}: ${selected.title}`} showFooter={false} size="2xl" className="max-w-5xl">
          <OnlyOfficeDocumentViewer key={selected.id} revisionId={selected.id} watchForChanges={false} height="68dvh" loadConfig={() => trainingFormTemplatesApi.viewConfig(selected.id)} />
        </FormModal>
      )}
      {editing && uploadOpen && (
        <FormModal isOpen onClose={() => setUploadOpen(false)} onConfirm={() => void doUpload()} title={`Upload a Template of ${code}`} confirmText="Upload" isLoading={busy} confirmDisabled={!upload.file || !/^\d{1,3}(\.\d{1,3}){0,2}$/.test(upload.versionLabel.trim())} size="lg"
          description="The Word file is uploaded Disabled and checked at once. It is used only after you enable it with your signature.">
          <div className="grid grid-cols-1 gap-4">
            <TrainingFileDropzone label="Word file (.docx)" required accept=".docx" maxMb={20} hint="The form with its tokens written in" file={upload.file} onChange={(f) => setUpload({ ...upload, file: f })} />
            <FormField label="Revision Number" required><Input value={upload.versionLabel} maxLength={20} placeholder="For example 2.0.0" onChange={(e) => setUpload({ ...upload, versionLabel: e.target.value })} /></FormField>
            <p className="text-xs text-slate-600">The revision in force of this form in Document Control. The form is written with the code {fullCode(code, upload.versionLabel)}.</p>
            <FormField label="Remark"><Textarea rows={2} value={upload.remark} onChange={(e) => setUpload({ ...upload, remark: e.target.value })} /></FormField>
          </div>
        </FormModal>
      )}
      <FormModal isOpen={!!styling} onClose={() => setStyling(undefined)} onConfirm={() => void doStyle()} title={`Signature Style: ${styling?.slot.name ?? ""}`} confirmText="Save" size="md" isLoading={busy} confirmDisabled={!styling?.reason.trim()}
        description={styling ? `${STYLE_LABEL[styling.style]}: ${STYLE_HINT[styling.style]} From the next form made. The reason stays in the Audit Trail.` : undefined}>
        {styling && <FormField label="Reason" required><Textarea rows={3} value={styling.reason} onChange={(e) => setStyling({ ...styling, reason: e.target.value })} /></FormField>}
      </FormModal>
    </div>
  );
}
