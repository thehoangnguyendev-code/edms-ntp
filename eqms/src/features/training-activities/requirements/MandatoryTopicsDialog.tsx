import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { statusColor } from "@/components/ui/badge/statusColors";
import { trainingError, trainingMandatoryTopicsApi, type TrainingMandatoryTopic } from "@/services/api/trainingActivities";
import { Input, Textarea } from "../shared/TrainingFields";
import { tr } from "@/i18n";

type Draft = { id?: string; name: string; nameVi: string; keyword: string; active: boolean; reason: string };
const blank: Draft = { name: "", nameVi: "", keyword: "", active: true, reason: "" };

/**
 * The contents SOP.0003 5.3.2 says the annual requirement includes. When no line of a requirement has the keyword in its title, the preparer is reminded; nothing is blocked.
 * Training Administration keeps the list, and every change is in the Audit Trail with its reason.
 */
export function MandatoryTopicsDialog({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<TrainingMandatoryTopic[]>();
  const [draft, setDraft] = useState<Draft>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => { trainingMandatoryTopicsApi.list().then(setItems).catch((e) => { setError(trainingError(e)); setItems([]); }); }, []);
  useEffect(load, [load]);
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      await trainingMandatoryTopicsApi.save(draft.id, { name: draft.name, nameVi: draft.nameVi, keyword: draft.keyword, active: draft.active, reason: draft.reason });
      setDraft(undefined);
      load();
    } catch (e) {
      setError(trainingError(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <FormModal isOpen onClose={onClose} onConfirm={onClose} title={tr("Contents the Annual Requirement Must Include")} confirmText={tr("Close")} showCancel={false} size="2xl"
      description={tr("SOP.0003 5.3.2 names General GMP, data integrity and aseptic technique. A requirement without a line that has the keyword in its title is reminded; nothing is blocked.")}>
      {!items ? <SectionLoading text="Loading…" /> : (
        <div className="space-y-4">
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {items.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0"><span className="font-medium text-slate-900">{t.name}</span>{t.nameVi && <span className="text-slate-500"> · {t.nameVi}</span>}<span className="ml-2 font-mono text-xs text-slate-500">{t.keyword}</span></div>
                <div className="flex items-center gap-2"><Badge color={statusColor(t.active ? "ACTIVE" : "INACTIVE")} size="sm">{t.active ? tr("Active") : tr("Inactive")}</Badge>
                  <Button size="sm" variant="outline-emerald" onClick={() => setDraft({ id: t.id, name: t.name, nameVi: t.nameVi ?? "", keyword: t.keyword, active: t.active, reason: "" })}>{tr("Edit")}</Button></div>
              </li>
            ))}
          </ul>
          {!draft && <Button size="sm" onClick={() => setDraft({ ...blank })}>{tr("New Item")}</Button>}
          {draft && (
            <div className="grid gap-3 rounded-lg border border-slate-200 p-3">
              <FormField label={tr("Item")} required><Input value={draft.name} maxLength={200} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></FormField>
              <FormField label={tr("Item (Vietnamese)")}><Input value={draft.nameVi} maxLength={200} onChange={(e) => setDraft({ ...draft, nameVi: e.target.value })} /></FormField>
              <FormField label={tr("Keyword in the title of a line")} required hint={tr("A line covers this content when its title has this word or phrase, in any letter case.")}><Input value={draft.keyword} maxLength={100} onChange={(e) => setDraft({ ...draft, keyword: e.target.value })} /></FormField>
              <Checkbox id="mandatory-active" label={tr("Active")} checked={draft.active} onChange={(on) => setDraft({ ...draft, active: on })} />
              <FormField label={tr("Reason")} required hint={tr("Written to the Audit Trail with the change.")}><Textarea rows={2} maxLength={1000} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></FormField>
              <div className="flex gap-2"><Button size="sm" loading={saving} disabled={!draft.name.trim() || !draft.keyword.trim() || !draft.reason.trim()} onClick={() => void save()}>{tr("Save")}</Button><Button size="sm" variant="outline-emerald" onClick={() => setDraft(undefined)}>{tr("Cancel")}</Button></div>
            </div>
          )}
        </div>
      )}
    </FormModal>
  );
}
