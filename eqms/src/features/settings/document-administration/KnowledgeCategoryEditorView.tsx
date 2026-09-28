import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Info, Layers, Plus, Star, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select } from "@/components/ui/select/Select";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { FormSection } from "@/components/ui/form/FormSection";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { knowledgeCategoryCreate, knowledgeCategoryEdit } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { knowledgeApi, type KnowledgeFieldOption, type KnowledgeHierarchy } from "@/services/api/knowledge";

const inputClass = "w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50";
const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";

/** A level in the editor. Changes stay in the browser until Save; id is missing for a level not saved yet. */
interface DraftLevel {
  id?: string;
  fieldCode: string;
  fieldLabel: string;
}

/** Everything typed so far, carried to "New Component" and back so nothing is lost. */
interface EditorDraft {
  name: string;
  description: string;
  determinator: string;
  active: boolean;
  levels: DraftLevel[];
}

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data?.error?.message ??
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
  fallback;

export const KnowledgeCategoryEditorView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navState = location.state as { draft?: EditorDraft; newComponent?: { sourceField: string; name: string } } | null;
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("documents.admin.knowledge_categories.manage");

  const [fields, setFields] = useState<KnowledgeFieldOption[]>([]);
  const [hierarchy, setHierarchy] = useState<KnowledgeHierarchy | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [determinator, setDeterminator] = useState("");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState<DraftLevel[]>([]);
  const draftApplied = useRef(false);

  const apply = useCallback((value: KnowledgeHierarchy) => {
    setHierarchy(value);
    setName(value.name);
    setDescription(value.description ?? "");
    setDeterminator(value.determinatorField);
    setActive(value.active);
    setLevels(value.levels.map((l) => ({ id: l.id, fieldCode: l.fieldCode, fieldLabel: l.fieldLabel })));
  }, []);

  useEffect(() => { knowledgeApi.listFields().then(setFields).catch(() => undefined); }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    knowledgeApi.getHierarchy(id)
      .then(apply)
      .catch((error) => showToast({ type: "error", title: "Failed to load", message: errorMessage(error, "Unable to load the hierarchy.") }))
      .finally(() => setLoading(false));
  }, [id, apply, showToast]);

  // Coming back from "New Component": restore what was being edited and add the new component as a level.
  useEffect(() => {
    if (draftApplied.current || loading || !navState?.draft || fields.length === 0) return;
    if (!isNew && !hierarchy) return;
    draftApplied.current = true;
    const draft = navState.draft;
    setName(draft.name);
    setDescription(draft.description);
    setDeterminator(draft.determinator);
    setActive(draft.active);
    let restored = draft.levels;
    const added = navState.newComponent;
    if (added && added.sourceField !== draft.determinator && !restored.some((l) => l.fieldCode === added.sourceField)) {
      restored = [...restored, { fieldCode: added.sourceField, fieldLabel: added.name }];
    }
    setLevels(restored);
  }, [navState, loading, hierarchy, isNew, fields.length]);

  const levelsDirty = useMemo(() => {
    const saved = hierarchy?.levels ?? [];
    return saved.length !== levels.length || saved.some((l, i) => l.id !== levels[i]?.id || l.fieldCode !== levels[i]?.fieldCode);
  }, [hierarchy, levels]);

  const dirty = useMemo(() => {
    if (isNew) return Boolean(name.trim() || determinator);
    return Boolean(hierarchy) && (name !== hierarchy!.name || description !== (hierarchy!.description ?? "")
      || determinator !== hierarchy!.determinatorField || active !== hierarchy!.active || levelsDirty);
  }, [isNew, name, description, determinator, active, hierarchy, levelsDirty]);

  const determinatorOptions = fields.filter((f) => f.determinatorEligible).map((f) => ({ label: f.label, value: f.value }));
  const levelOptions = fields.filter((f) => f.value !== determinator).map((f) => ({ label: `${f.label} ({{${f.value.toLowerCase()}}})`, value: f.value }));
  const labelOf = (code: string) => fields.find((f) => f.value === code)?.label;
  const determinatorLabel = labelOf(determinator) ?? hierarchy?.determinatorLabel;
  const previewPath = [determinatorLabel, ...levels.map((l) => labelOf(l.fieldCode) ?? l.fieldLabel)].filter(Boolean).join(" > ");

  const changeDeterminator = (value: string) => {
    setDeterminator(value);
    // A field cannot be both the Knowledge Base and one of its levels.
    if (levels.some((l) => l.fieldCode === value)) {
      setLevels((current) => current.filter((l) => l.fieldCode !== value));
      showToast({ type: "info", title: "Level removed", message: `"${labelOf(value) ?? value}" is now the Knowledge Base, so it was removed from the levels.` });
    }
  };

  const pickLevels = (values: (string | number)[]) => {
    const codes = values.map(String);
    const wanted = new Set(codes);
    const kept = levels.filter((l) => wanted.has(l.fieldCode));
    const keptCodes = new Set(kept.map((l) => l.fieldCode));
    const added = codes.filter((code) => !keptCodes.has(code)).map((code) => ({ fieldCode: code, fieldLabel: labelOf(code) ?? code }));
    setLevels([...kept, ...added]);
  };

  const moveLevel = (index: number, delta: number) => {
    setLevels((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeLevel = (index: number) => setLevels((current) => current.filter((_, i) => i !== index));

  const openNewComponent = () => {
    const draft: EditorDraft = { name, description, determinator, active, levels };
    navigate(ROUTES.DOCUMENTS.ADMIN.KNOWLEDGE_COMPONENTS_NEW, { state: { returnTo: location.pathname, draft } });
  };

  const save = async () => {
    if (!name.trim() || !determinator) {
      showToast({ type: "error", title: "Missing information", message: "Name and Knowledge Base Field Determinator are required." });
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || undefined, determinatorField: determinator, active };
      if (isNew) {
        const created = await knowledgeApi.createHierarchy(payload);
        showToast({ type: "success", title: "Hierarchy created", message: "Add levels to build the category tree." });
        navigate(ROUTES.DOCUMENTS.ADMIN.KNOWLEDGE_CATEGORIES_EDIT(created.id), { replace: true });
      } else {
        apply(await knowledgeApi.updateHierarchy(id!, { ...payload, levels: levels.map((l) => ({ id: l.id, fieldCode: l.fieldCode })) }));
        showToast({ type: "success", title: "Saved", message: "The hierarchy was updated." });
      }
    } catch (error) {
      showToast({ type: "error", title: "Save failed", message: errorMessage(error, "Unable to save the hierarchy.") });
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async () => {
    if (!hierarchy) return;
    try {
      apply(await knowledgeApi.setDefault(hierarchy.id));
      showToast({ type: "success", title: "Default changed", message: `"${hierarchy.name}" now drives the Knowledge portal.` });
    } catch (error) {
      showToast({ type: "error", title: "Could not change the default", message: errorMessage(error, "Unable to change the default hierarchy.") });
    }
  };

  if (loading) return <FullPageLoading text="Loading hierarchy..." />;

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title={isNew ? "New Knowledge Categories Hierarchy" : "Edit Knowledge Categories Hierarchy"}
        breadcrumbItems={isNew ? knowledgeCategoryCreate(navigate) : knowledgeCategoryEdit(navigate, hierarchy?.name)}
        actions={
          <>
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => navigate(ROUTES.DOCUMENTS.ADMIN.KNOWLEDGE_CATEGORIES)}>
              Back
            </Button>
            {canManage && !isNew && hierarchy && !hierarchy.isDefault && (
              <Button size="sm" variant="outline-emerald" className="whitespace-nowrap gap-2" disabled={!hierarchy.active || dirty} onClick={() => void makeDefault()}>
                <Star className="h-4 w-4" />
                Set as Default
              </Button>
            )}
            {canManage && (
              <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" disabled={!dirty || saving} onClick={() => void save()}>
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
          </>
        }
      />

      <FormSection
        title="General"
        icon={<Info className="h-4 w-4" />}
        headerRight={hierarchy?.isDefault ? <Badge size="sm" color="blue">Default</Badge> : undefined}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Name <span className="text-red-500">*</span></label>
              <input className={inputClass} value={name} maxLength={200} disabled={!canManage} onChange={(e) => setName(e.target.value)} />
            </div>
            <Select
              label={<>Knowledge Base Field Determinator <span className="text-red-500">*</span></>}
              value={determinator}
              onChange={(value) => changeDeterminator(String(value))}
              options={determinatorOptions}
              disabled={!canManage}
              placeholder="Select a field..."
            />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 resize-none"
              rows={3} value={description} disabled={!canManage} onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1.5">The determinator field decides which Knowledge Base a document belongs to (for example, each Business Unit is one Knowledge Base). Only fields with one low-cardinality value per document can be a determinator.</p>
          </div>
          <div>
            <Checkbox id="knowledge-hierarchy-active" label="Active" checked={active} onChange={setActive} disabled={!canManage || Boolean(hierarchy?.isDefault)} />
            {hierarchy?.isDefault && <p className="text-xs text-slate-500 mt-1.5">The default hierarchy must stay active. Make another hierarchy the default first.</p>}
          </div>
        </div>
      </FormSection>

      {/* Levels only exist once the hierarchy has been saved */}
      {!isNew && (
        <FormSection
          title="Knowledge Category Levels"
          icon={<Layers className="h-4 w-4" />}
          description="Add levels in the order they should appear. Use the arrows to reorder."
          contentClassName="p-4 md:p-5"
          headerRight={canManage ? (
            <Button type="button" variant="default" size="sm" onClick={openNewComponent} className="gap-1.5 whitespace-nowrap shrink-0">
              <Plus className="h-3.5 w-3.5" />
              New Component
            </Button>
          ) : undefined}
        >
          {levels.length > 0 && (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-4">
              {levels.map((level, index) => (
                <div key={level.id ?? level.fieldCode} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xs font-semibold text-slate-500">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">{labelOf(level.fieldCode) ?? level.fieldLabel}</span>
                    <code className="text-2xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 whitespace-nowrap">{"{{" + level.fieldCode.toLowerCase() + "}}"}</code>
                  </div>
                  {canManage && (
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <button type="button" aria-label="Move up" onClick={() => moveLevel(index, -1)} disabled={index === 0}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                        <ArrowUp className="h-3.5 w-3.5 text-slate-500" />
                      </button>
                      <button type="button" aria-label="Move down" onClick={() => moveLevel(index, 1)} disabled={index === levels.length - 1}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                        <ArrowDown className="h-3.5 w-3.5 text-slate-500" />
                      </button>
                      <button type="button" aria-label="Remove level" onClick={() => removeLevel(index)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {canManage && (
            <MultiSelect
              value={levels.map((l) => l.fieldCode)}
              onChange={pickLevels}
              options={levelOptions}
              placeholder="Select components to add..."
              searchPlaceholder="Search components..."
            />
          )}

          {levels.length === 0 && !canManage && (
            <p className="text-sm text-slate-500">No levels: documents are listed directly under each Knowledge Base.</p>
          )}

          {previewPath && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-900">Preview</p>
              <p className="mt-0.5 text-sm text-emerald-800 break-words">{previewPath}</p>
            </div>
          )}
        </FormSection>
      )}
    </div>
  );
};
