import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconPencil } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { trainingAdministrationBase } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Input, Textarea } from "@/features/training-activities/shared/TrainingFields";
import { when } from "@/features/training-activities/shared/trainingLabels";
import { trainingCodeRulesApi, trainingError, type TrainingCodeRule } from "@/services/api/trainingActivities";

/** The parts a pattern can use, with what each one gives. The server checks the pattern; this list only helps to write it. */
const PARTS: { token: string; text: string }[] = [
  { token: "{YYYY}", text: "Year, four digits (2026)" },
  { token: "{YY}", text: "Year, two digits (26)" },
  { token: "{DEPT}", text: "Code of the department (QA)" },
  { token: "{SEQ:3}", text: "Next number, here three digits (001); the digits can be 1 to 8" },
];

/** What each record needs, and when its number starts again. */
const NOTE: Record<TrainingCodeRule["entity"], string> = {
  REQUIREMENT: "Needs the number. The number starts again each year when the pattern has the year.",
  MATRIX: "Needs the department: a department has one matrix. The number is optional.",
  ASSESSMENT: "Needs the number. An assessment belongs to no department.",
};

/**
 * The rules of the codes of the Training Requirement, the Training Matrix and the Training Assessment. SOP.0003 gives a rule only for the Training Number; these codes are set by the company here.
 * A rule applies to the codes made after it: the codes already issued do not change. The server checks the pattern, gives the next number and writes the change to the Audit Trail.
 */
export function TrainingCodeRulesView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.settings.manage");
  const [rules, setRules] = useState<TrainingCodeRule[]>();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ rule: TrainingCodeRule; pattern: string; reason: string }>();
  const [example, setExample] = useState<{ text: string; error: string }>({ text: "", error: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => { trainingCodeRulesApi.list().then(setRules).catch((e) => setError(trainingError(e))); }, []);
  useEffect(load, [load]);

  // The example is asked from the server while the pattern is typed, so what is shown is what the server would write.
  useEffect(() => {
    if (!editing) return;
    const pattern = editing.pattern.trim();
    const timer = window.setTimeout(() => {
      trainingCodeRulesApi.preview(editing.rule.entity, pattern)
        .then((r) => setExample({ text: r.example, error: "" }))
        .catch((e) => setExample({ text: "", error: trainingError(e) }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [editing?.rule.entity, editing?.pattern]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await trainingCodeRulesApi.update(editing.rule.entity, { version: editing.rule.version, pattern: editing.pattern.trim(), reason: editing.reason.trim() || undefined });
      showToast({ type: "success", title: "The rule was saved", message: `${editing.rule.label}: the codes made from now on follow it.` });
      setEditing(undefined);
      load();
    } catch (e) {
      showToast({ type: "error", title: "The rule was not saved", message: trainingError(e) });
    } finally {
      setSaving(false);
    }
  };

  const open = (rule: TrainingCodeRule) => { setExample({ text: rule.example, error: "" }); setEditing({ rule, pattern: rule.pattern, reason: "" }); };

  return (
    <div className="flex h-full flex-col gap-4 md:gap-6">
      <PageHeader title="Training Code Rules" breadcrumbItems={[...trainingAdministrationBase(navigate), { label: "Training Code Rules", isActive: true }]} />
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <p className="text-sm text-slate-600">
        SOP.0003 sets the rule of the Training Number only. The codes of the Training Requirement, the Training Matrix and the Training Assessment are set here. A rule applies to the codes made after it; the codes already issued do not change. The number goes on from the last one made: it does not start again when the pattern changes, so a number is never used twice.
      </p>
      {!rules ? <SectionLoading text="Loading the code rules…" /> : (
        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
          {rules.map((r) => (
            <section key={r.entity} aria-label={r.label} className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 md:text-base">{r.label}</h2>
                {canManage && <Button size="sm" variant="outline-emerald" className="gap-1 whitespace-nowrap" aria-label={`Edit the rule of the ${r.label}`} onClick={() => open(r)}><IconPencil className="h-4 w-4" />Edit</Button>}
              </div>
              <dl className="grid gap-2 text-sm">
                <div><dt className="text-xs text-slate-500">Pattern</dt><dd className="break-all font-mono text-slate-900">{r.pattern}</dd></div>
                <div><dt className="text-xs text-slate-500">Next code looks like</dt><dd className="font-mono font-semibold text-emerald-700">{r.example || "—"}</dd></div>
                <div><dt className="text-xs text-slate-500">Last changed</dt><dd className="text-slate-700">{r.updatedAt ? `${when(r.updatedAt)}${r.updatedByName ? ` by ${r.updatedByName}` : ""}` : "Default rule"}</dd></div>
              </dl>
              <p className="text-xs text-slate-500">{NOTE[r.entity]}</p>
            </section>
          ))}
        </div>
      )}
      <FormModal
        isOpen={!!editing} onClose={() => setEditing(undefined)} title={`Rule of the ${editing?.rule.label ?? "code"}`} confirmText="Save" size="md" isLoading={saving}
        confirmDisabled={!editing || !editing.pattern.trim() || !!example.error || editing.pattern.trim() === editing.rule.pattern}
        description="Write the pattern with letters, digits, / . _ - and the parts below. The example is made by the server."
        onConfirm={() => void save()}
      >
        {editing && (
          <div className="grid gap-4">
            <FormField label="Pattern" required>
              <Input value={editing.pattern} maxLength={60} className="font-mono" aria-label="Pattern" onChange={(e) => setEditing({ ...editing, pattern: e.target.value })} />
            </FormField>
            <div className="flex flex-wrap gap-2" aria-label="Parts of a pattern">
              {PARTS.map((p) => (
                <button key={p.token} type="button" title={p.text} onClick={() => setEditing({ ...editing, pattern: `${editing.pattern}${p.token}` })}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-700 hover:border-emerald-400 hover:bg-emerald-50">{p.token}</button>
              ))}
            </div>
            <ul className="space-y-1 text-xs text-slate-500">{PARTS.map((p) => <li key={p.token}><span className="font-mono text-slate-700">{p.token}</span> {p.text}</li>)}</ul>
            <div aria-live="polite">
              <div className="text-xs text-slate-500">The code would look like</div>
              {example.error ? <p className="text-sm text-red-700">{example.error}</p> : <p className="font-mono text-base font-semibold text-emerald-700">{example.text || "—"}</p>}
            </div>
            <FormField label="Reason" hint="Written to the Audit Trail with the change."><Textarea rows={2} maxLength={1000} value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} /></FormField>
          </div>
        )}
      </FormModal>
    </div>
  );
}
