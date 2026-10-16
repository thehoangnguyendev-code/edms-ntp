import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { IconInfoCircle } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { usePermissions } from "@/hooks/usePermissions";
import { reportError } from "@/services/api/reportTemplates";
import {
  REPORT_NAME_SEPARATORS,
  reportNameFormatsApi,
  type ReportNameFormat,
  type ReportNameFormatWrite,
  type ReportNameInputRule,
  type ReportNamePartType,
} from "@/services/api/reportNameFormats";

/** One part as the editor holds it. Fixed parts use fixedText; input parts use inputLabel, inputRule and maxLength. */
interface PartDraft {
  type: ReportNamePartType;
  fixedText: string;
  inputLabel: string;
  inputRule: ReportNameInputRule;
  maxLength: number;
}

const RULE_LABEL: Record<ReportNameInputRule, string> = {
  TEXT: "Text (no markup or control characters)",
  UPPER_CODE: "Upper-case code (A-Z, 0-9, underscore)",
  DIGITS: "Digits only",
};

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,79}$/;
// The same field styles as the Document Name Format editor.
const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const inputClass =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-600";
const textareaClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 resize-none disabled:bg-slate-100 disabled:text-slate-600";
const iconButtonClass = "flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent";

/** The example as the server shows it: fixed parts as written, input parts as their labels in angle brackets. */
function example(parts: PartDraft[], separator: string) {
  return parts.map((part) => (part.type === "FIXED" ? part.fixedText || "…" : `<${part.inputLabel || "…"}>`)).join(separator);
}

const snapshotOf = (value: { code: string; name: string; separator: string; description: string; parts: PartDraft[] }) => JSON.stringify(value);

/**
 * Create or change a name format (REPORT-NAME-FORMAT-2026-10-14), laid out like the Document Name Format editor: General and Parts sections,
 * a numbered list with arrows to reorder, and a preview. The server checks every rule again on save.
 */
export function ReportNameFormatEditView() {
  const { id = "new" } = useParams();
  const create = id === "new";
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasAnyPermission } = usePermissions();
  // ?mode=view opens the format for reading only, from "View Detail" in the list.
  const [searchParams] = useSearchParams();
  const viewing = searchParams.get("mode") === "view";
  const editable = hasAnyPermission(["reports.name_format.manage"]) && !viewing;
  const [loading, setLoading] = useState(!create);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [stored, setStored] = useState<ReportNameFormat>();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [separator, setSeparator] = useState<string>(" - ");
  const [description, setDescription] = useState("");
  const [parts, setParts] = useState<PartDraft[]>([
    { type: "FIXED", fixedText: "", inputLabel: "", inputRule: "TEXT", maxLength: 100 },
    { type: "INPUT", fixedText: "", inputLabel: "", inputRule: "TEXT", maxLength: 100 },
  ]);
  // What the server last returned (Edit only). Save stays disabled until the form differs from it.
  const [baseline, setBaseline] = useState<string | null>(null);
  const [saveReason, setSaveReason] = useState<{ reason: string }>();
  /** The part being added (index null) or changed, in the dialog. */
  const [editing, setEditing] = useState<{ index: number | null; draft: PartDraft }>();
  const NEW_PART: PartDraft = { type: "INPUT", fixedText: "", inputLabel: "", inputRule: "TEXT", maxLength: 100 };
  const draftProblem = (draft: PartDraft) =>
    draft.type === "FIXED" ? (draft.fixedText.trim() ? "" : "Enter the text.") : draft.inputLabel.trim() ? "" : "Enter the label.";
  const applyEditing = () => {
    if (!editing || draftProblem(editing.draft)) return;
    const { index, draft } = editing;
    setParts((current) => (index === null ? [...current, draft] : current.map((part, i) => (i === index ? draft : part))));
    setEditing(undefined);
  };

  useEffect(() => {
    if (create) return;
    let alive = true;
    reportNameFormatsApi
      .detail(id)
      .then((format) => {
        if (!alive) return;
        const loaded = format.parts.map((part) => ({
          type: part.type,
          fixedText: part.fixedText ?? "",
          inputLabel: part.inputLabel ?? "",
          inputRule: (part.inputRule ?? "TEXT") as ReportNameInputRule,
          maxLength: part.maxLength ?? 100,
        }));
        setStored(format);
        setCode(format.code);
        setName(format.name);
        setSeparator(format.separator);
        setDescription(format.description ?? "");
        setParts(loaded);
        setBaseline(snapshotOf({ code: format.code, name: format.name, separator: format.separator, description: format.description ?? "", parts: loaded }));
      })
      .catch((e) => alive && setLoadError(reportError(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, create]);

  const move = (index: number, to: number) =>
    setParts((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  /** The rule may be saved only when its own rules hold; the server checks them again. */
  const problem = (() => {
    if (!create && !stored) return "";
    if (!CODE_PATTERN.test(code)) return "Code: 3 to 80 characters, upper case, digits and underscore, starting with a letter.";
    if (!name.trim() || name.length > 120) return "Name is required (up to 120 characters).";
    if (!REPORT_NAME_SEPARATORS.includes(separator as (typeof REPORT_NAME_SEPARATORS)[number])) return "Choose a separator.";
    if (parts.length === 0 || parts.length > 10) return "A rule has 1 to 10 parts.";
    if (!parts.some((part) => part.type === "INPUT")) return "A rule needs at least one part typed for each template.";
    for (const part of parts) {
      if (part.type === "FIXED" && !part.fixedText.trim()) return "A fixed part needs its text.";
      if (part.type === "INPUT" && !part.inputLabel.trim()) return "A typed part needs its label.";
    }
    return "";
  })();

  const isDirty = baseline === null ? Boolean(code.trim() || name.trim() || description.trim()) : snapshotOf({ code, name, separator, description, parts }) !== baseline;
  const canSubmit = !problem && isDirty && !saving;

  const goBack = () => navigate("/settings/report-name-formats");

  const save = async (reason: string) => {
    setSaving(true);
    try {
      const payload = {
        code,
        name: name.trim(),
        separator,
        description,
        parts: parts.map((part): ReportNameFormatWrite["parts"][number] =>
          part.type === "FIXED"
            ? { type: "FIXED", fixedText: part.fixedText.trim(), inputLabel: null, inputRule: null, maxLength: null }
            : { type: "INPUT", fixedText: null, inputLabel: part.inputLabel.trim(), inputRule: part.inputRule, maxLength: part.maxLength },
        ),
        reason,
        version: stored?.version,
      };
      if (create) await reportNameFormatsApi.create(payload);
      else await reportNameFormatsApi.update(id, payload);
      showToast({
        type: "success",
        title: create ? "Report Name Format Created" : "Report Name Format Updated",
        message: `"${name.trim()}" has been ${create ? "created" : "updated"} successfully. Example: ${example(parts, separator)}`,
      });
      goBack();
    } catch (e) {
      showToast({ type: "error", title: create ? "Create Failed" : "Update Failed", message: reportError(e) });
    } finally {
      setSaving(false);
      setSaveReason(undefined);
    }
  };

  const title = create ? "New Report Name Format" : viewing ? "Report Name Format Details" : "Edit Report Name Format";
  return (
    <div className="h-full flex flex-col gap-6">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(navigate, title, true, { label: "Report Name Formats", onClick: goBack })}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline-emerald" onClick={goBack} className="whitespace-nowrap">
              Back
            </Button>
            {editable && (
              <Button size="sm" variant="outline-emerald" onClick={() => setSaveReason({ reason: "" })} disabled={!canSubmit} className="whitespace-nowrap">
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <SectionLoading text="Loading report name format..." />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center">
          <p role="alert" className="text-sm font-medium text-amber-800">{loadError}</p>
          <Button size="sm" variant="outline" onClick={goBack}>Back to list</Button>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-4 md:space-y-6 pb-6">
          <FormSection title="General" icon={<IconInfoCircle className="h-4 w-4" />} contentClassName="p-4 md:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>
                  Name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Report Title Format" disabled={saving || !editable} />
              </div>
              <div>
                <label className={labelClass}>
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  maxLength={80}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className={inputClass}
                  placeholder="e.g. REPORT_TITLE"
                  disabled={saving || !editable || !create}
                />
                {!create && <p className="mt-1.5 text-xs text-slate-500">The code does not change after the format is created.</p>}
              </div>
              <div>
                <label className={labelClass}>
                  Separator <span className="text-red-500">*</span>
                </label>
                <Select
                  value={separator}
                  disabled={saving || !editable}
                  options={REPORT_NAME_SEPARATORS.map((value) => ({ value, label: value.trim() === "" ? "space" : value }))}
                  onChange={(value) => setSeparator(String(value))}
                />
              </div>
              <div className="sm:col-span-3">
                <label className={labelClass}>Description</label>
                <textarea
                  value={description}
                  maxLength={500}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className={textareaClass}
                  placeholder="The name shown to people who choose this rule for a template"
                  disabled={saving || !editable}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Parts"
            description="Add parts in the order they should appear. Fixed parts are written as they are; typed parts are filled in for each template and must follow their rule. Use the arrows to reorder."
            contentClassName="p-4 md:p-5"
            headerRight={
              editable && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={parts.length >= 10}
                  onClick={() => setEditing({ index: null, draft: { ...NEW_PART } })}
                  className="gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Part
                </Button>
              )
            }
          >
            {parts.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-4">
                {parts.map((part, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xs font-semibold text-slate-500">{index + 1}</span>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {part.type === "FIXED" ? (
                        <>
                          <span className="text-sm font-medium text-slate-900 truncate">Fixed text</span>
                          <code className="text-2xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 whitespace-nowrap">{part.fixedText || "…"}</code>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-slate-900 truncate">{part.inputLabel || "…"}</span>
                          <code className="text-2xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 whitespace-nowrap">{"{{typed}}"}</code>
                          <span className="hidden sm:inline text-2xs text-slate-500 truncate">
                            {RULE_LABEL[part.inputRule].split(" (")[0]}, up to {part.maxLength} characters
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {editable && (
                        <button type="button" aria-label="Edit part" onClick={() => setEditing({ index, draft: { ...part } })} className={iconButtonClass}>
                          <Pencil className="h-3.5 w-3.5 text-slate-500" />
                        </button>
                      )}
                      <button type="button" aria-label="Move up" onClick={() => move(index, index - 1)} disabled={index === 0 || !editable} className={iconButtonClass}>
                        <ArrowUp className="h-3.5 w-3.5 text-slate-500" />
                      </button>
                      <button type="button" aria-label="Move down" onClick={() => move(index, index + 1)} disabled={index === parts.length - 1 || !editable} className={iconButtonClass}>
                        <ArrowDown className="h-3.5 w-3.5 text-slate-500" />
                      </button>
                      {editable && (
                        <button
                          type="button"
                          aria-label="Remove part"
                          onClick={() => setParts((current) => current.filter((_, i) => i !== index))}
                          disabled={parts.length <= 1}
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {problem && editable && <p className="mb-3 text-xs sm:text-sm text-amber-700">{problem}</p>}

            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-xs sm:text-sm font-medium text-emerald-700 mb-1">Preview</p>
              <p className="text-sm text-emerald-900 break-all">{example(parts, separator)}</p>
            </div>
          </FormSection>
        </div>
      )}
      <FormModal
        isOpen={!!editing}
        onClose={() => setEditing(undefined)}
        title={editing?.index === null ? "New Part" : "Edit Part"}
        description="A fixed part is written as it is. A typed part is filled in for each template and must follow its rule."
        confirmText={editing?.index === null ? "Add Part" : "Apply"}
        confirmDisabled={!editing || !!draftProblem(editing.draft)}
        onConfirm={applyEditing}
      >
        {editing && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Type</label>
              <Select
                value={editing.draft.type}
                options={[
                  { value: "INPUT", label: "Typed for each template" },
                  { value: "FIXED", label: "Fixed text" },
                ]}
                onChange={(value) => setEditing((current) => current && { ...current, draft: { ...current.draft, type: value as ReportNamePartType } })}
              />
            </div>
            {editing.draft.type === "FIXED" ? (
              <div>
                <label className={labelClass}>
                  Text <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editing.draft.fixedText}
                  maxLength={100}
                  onChange={(e) => setEditing((current) => current && { ...current, draft: { ...current.draft, fixedText: e.target.value } })}
                  className={inputClass}
                  placeholder="e.g. EQMS"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className={labelClass}>
                    Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editing.draft.inputLabel}
                    maxLength={100}
                    onChange={(e) => setEditing((current) => current && { ...current, draft: { ...current.draft, inputLabel: e.target.value } })}
                    className={inputClass}
                    placeholder="e.g. Report title"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Rule</label>
                    <Select
                      value={editing.draft.inputRule}
                      options={(Object.keys(RULE_LABEL) as ReportNameInputRule[]).map((rule) => ({ value: rule, label: RULE_LABEL[rule] }))}
                      onChange={(value) => setEditing((current) => current && { ...current, draft: { ...current.draft, inputRule: value as ReportNameInputRule } })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Longest (characters)</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={editing.draft.maxLength}
                      onChange={(e) =>
                        setEditing((current) => current && { ...current, draft: { ...current.draft, maxLength: Math.min(200, Math.max(1, Number(e.target.value) || 1)) } })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </FormModal>
      <FormModal
        isOpen={!!saveReason}
        onClose={() => setSaveReason(undefined)}
        title={create ? "Create name format" : "Save name format"}
        description="Templates already named by this rule keep their names. Say why this rule changes. The reason is recorded with your name and the time."
        confirmText="Save"
        confirmDisabled={!saveReason?.reason.trim() || saving}
        onConfirm={() => saveReason && void save(saveReason.reason.trim())}
      >
        <FormField label="Reason" required>
          <Textarea rows={3} maxLength={1000} value={saveReason?.reason ?? ""} onChange={(event) => setSaveReason((current) => current && { ...current, reason: event.target.value })} />
        </FormField>
      </FormModal>
    </div>
  );
}
