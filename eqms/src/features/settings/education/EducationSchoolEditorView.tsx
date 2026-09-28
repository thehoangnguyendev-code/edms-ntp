import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Landmark, School } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { educationSchoolEditor } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { educationApi } from "@/services/api";
import type { SchoolPayload } from "./types";
import { useToast } from "@/components/ui/toast";
import { extractApiMessage } from "../shared/utils";
import type { SchoolItem, SchoolOwnership, SchoolType } from "./types";
import { SCHOOL_OWNERSHIP_OPTIONS, SCHOOL_TYPE_OPTIONS } from "./types";

type SchoolEditorData = Pick<SchoolPayload, "name" | "abbreviation" | "type" | "ownership" | "isActive" | "governingBody" | "countryOfOriginName">;

const emptyForm = (): SchoolEditorData => ({ name: "", abbreviation: null, type: "UNIVERSITY", ownership: null, isActive: true, governingBody: null, countryOfOriginName: null });
const formFromSchool = (school: SchoolItem): SchoolEditorData => ({ name: school.name, abbreviation: school.abbreviation ?? null, type: school.type, ownership: school.ownership ?? null, isActive: school.isActive, governingBody: school.governingBody ?? null, countryOfOriginName: school.countryOfOriginName ?? null });
const labelClass = "mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm";
const inputClass = "h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-50";
const nullIfBlank = (value: string) => value.trim() || null;

/** Full-page School form. It contains only editable fields displayed in the Schools table. */
export const EducationSchoolEditorView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEdit = Boolean(id);
  const [form, setForm] = React.useState<SchoolEditorData>(emptyForm);
  const [loading, setLoading] = React.useState(isEdit);
  const [saving, setSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [governingBodies, setGoverningBodies] = React.useState<string[]>([]);
  const [loadingGoverningBodies, setLoadingGoverningBodies] = React.useState(true);

  React.useEffect(() => {
    if (!id) return;
    let active = true;
    educationApi.schools.get(id)
      .then((school) => { if (active) setForm(formFromSchool(school)); })
      .catch((error) => { if (active) setLoadError(extractApiMessage(error, "Unable to load school.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  React.useEffect(() => {
    let active = true;
    educationApi.schools.filterOptions()
      .then(({ governingBodies: values }) => { if (active) setGoverningBodies(values); })
      .catch(() => { if (active) setGoverningBodies([]); })
      .finally(() => { if (active) setLoadingGoverningBodies(false); });
    return () => { active = false; };
  }, []);

  const governingBodyOptions = React.useMemo(() => {
    const currentValue = form.governingBody?.trim();
    const values = currentValue && !governingBodies.includes(currentValue)
      ? [currentValue, ...governingBodies]
      : governingBodies;
    return [{ label: "Unspecified", value: "" }, ...values.map((value) => ({ label: value, value }))];
  }, [form.governingBody, governingBodies]);

  const update = <K extends keyof SchoolEditorData>(key: K, value: SchoolEditorData[K]) => setForm((current) => ({ ...current, [key]: value }));
  const goBack = () => navigate("/settings/education/schools");

  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload: SchoolPayload = {
      ...form,
      name: form.name.trim(),
      abbreviation: form.abbreviation ? nullIfBlank(form.abbreviation) : null,
      governingBody: form.governingBody ? nullIfBlank(form.governingBody) : null,
      countryOfOriginName: form.countryOfOriginName ? nullIfBlank(form.countryOfOriginName) : null,
    };
    try {
      const saved = isEdit && id ? await educationApi.schools.update(id, payload) : await educationApi.schools.create(payload);
      showToast({ type: "success", title: isEdit ? "School Updated" : "School Created", message: `"${saved.name}" has been saved.` });
      goBack();
    } catch (error) {
      showToast({ type: "error", title: "Save Failed", message: extractApiMessage(error, "Unable to save school.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader title={isEdit ? "Edit School" : "New School"} breadcrumbItems={educationSchoolEditor(navigate, isEdit ? "edit" : "new")}
        actions={<div className="flex items-center gap-2"><Button size="sm" variant="outline-emerald" onClick={goBack}>Back</Button><Button size="sm" variant="outline-emerald" onClick={submit} disabled={saving || !form.name.trim()}>{saving ? "Saving..." : "Save"}</Button></div>} />
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm"><SectionLoading text="Loading school..." /></div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center"><p className="text-sm font-medium text-amber-800">{loadError}</p><Button size="sm" variant="outline" onClick={goBack}>Back to Schools</Button></div>
      ) : (
        <div className="flex-1 overflow-auto pb-6"><div className="w-full space-y-4 md:space-y-6">
          <FormSection title="School Information" description="Core information used to identify and classify the school." icon={<School className="h-4 w-4" />} contentClassName="p-4 md:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className={labelClass}>School Name <span className="text-red-500">*</span></label><input required value={form.name} onChange={(event) => update("name", event.target.value)} className={inputClass} placeholder="e.g. Hanoi University of Science and Technology" disabled={saving} /></div>
              <div><label className={labelClass}>Abbreviation</label><input value={form.abbreviation ?? ""} onChange={(event) => update("abbreviation", event.target.value)} className={inputClass} placeholder="e.g. HUST" disabled={saving} /></div>
              <div><label className={labelClass}>Type <span className="text-red-500">*</span></label><Select value={form.type} onChange={(value) => update("type", value as SchoolType)} options={SCHOOL_TYPE_OPTIONS} /></div>
              <div><label className={labelClass}>Ownership</label><Select value={form.ownership ?? ""} onChange={(value) => update("ownership", (value || null) as SchoolOwnership | null)} options={[{ label: "Unspecified", value: "" }, ...SCHOOL_OWNERSHIP_OPTIONS]} /></div>
              <div className="flex items-end pb-1"><Checkbox id="school-active" checked={form.isActive} onChange={(checked) => update("isActive", checked)} label="Active" disabled={saving} /></div>
            </div>
          </FormSection>
          <FormSection title="Governance & Origin" description="Optional reference information used by the Schools table filters." icon={<Landmark className="h-4 w-4" />} contentClassName="p-4 md:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Governing Body</label><Select value={form.governingBody ?? ""} onChange={(value) => update("governingBody", value || null)} options={governingBodyOptions} placeholder="Select governing body" searchPlaceholder="Search governing bodies..." isLoading={loadingGoverningBodies} loadingText="Loading governing bodies..." disabled={saving} /></div>
              <div><label className={labelClass}>Origin</label><input value={form.countryOfOriginName ?? ""} onChange={(event) => update("countryOfOriginName", event.target.value)} className={inputClass} placeholder="e.g. Vietnam" disabled={saving} /></div>
            </div>
          </FormSection>
        </div></div>
      )}
    </div>
  );
};
