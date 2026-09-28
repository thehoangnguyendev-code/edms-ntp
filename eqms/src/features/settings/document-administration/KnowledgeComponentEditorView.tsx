import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select } from "@/components/ui/select/Select";
import { FormSection } from "@/components/ui/form/FormSection";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { knowledgeComponentCreate, knowledgeComponentEdit } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { knowledgeApi, type KnowledgeComponent, type KnowledgeSourceOption } from "@/services/api/knowledge";

const inputClass = "w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50";
const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data?.error?.message ??
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
  fallback;

/**
 * New/Edit Knowledge Category Component. When opened from a hierarchy's "New Component" button,
 * location.state.returnTo/draft carry that unsaved hierarchy, and Back/Save return to it (Save also
 * hands back the new component so it can be added to the hierarchy's levels).
 */
export const KnowledgeComponentEditorView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navState = location.state as { returnTo?: string; draft?: unknown } | null;
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("documents.admin.knowledge_categories.manage");

  const [component, setComponent] = useState<KnowledgeComponent | null>(null);
  const [sources, setSources] = useState<KnowledgeSourceOption[]>([]);
  const [name, setName] = useState("");
  const [sourceField, setSourceField] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const apply = useCallback((value: KnowledgeComponent) => {
    setComponent(value);
    setName(value.name);
    setSourceField(value.sourceField);
    setDescription(value.description ?? "");
    setActive(value.active);
  }, []);

  useEffect(() => {
    if (isNew) knowledgeApi.listComponentSources().then(setSources).catch(() => undefined);
  }, [isNew]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    knowledgeApi.getComponent(id).then(apply)
      .catch((error) => showToast({ type: "error", title: "Failed to load", message: errorMessage(error, "Unable to load the component.") }))
      .finally(() => setLoading(false));
  }, [id, apply, showToast]);

  const dirty = useMemo(() => {
    if (isNew) return Boolean(name.trim() || sourceField || description.trim());
    return Boolean(component) && (name !== component!.name || description !== (component!.description ?? "") || active !== component!.active);
  }, [isNew, name, sourceField, description, active, component]);

  const goBack = () => {
    if (navState?.returnTo) navigate(navState.returnTo, { state: { draft: navState.draft } });
    else navigate(ROUTES.DOCUMENTS.ADMIN.KNOWLEDGE_COMPONENTS);
  };

  const sourceLabel = sources.find((s) => s.value === sourceField)?.label;
  const canSave = canManage && dirty && !saving && Boolean(name.trim()) && Boolean(sourceField);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || undefined, active };
      if (isNew) {
        const created = await knowledgeApi.createComponent({ ...payload, sourceField });
        showToast({ type: "success", title: "Component created", message: `"${created.name}" is now available for hierarchies.` });
        if (navState?.returnTo) {
          navigate(navState.returnTo, { state: { draft: navState.draft, newComponent: { sourceField: created.sourceField, name: created.name } } });
        } else {
          navigate(ROUTES.DOCUMENTS.ADMIN.KNOWLEDGE_COMPONENTS, { replace: true });
        }
      } else {
        apply(await knowledgeApi.updateComponent(id!, payload));
        showToast({ type: "success", title: "Saved", message: "The component was updated." });
      }
    } catch (error) {
      showToast({ type: "error", title: "Save failed", message: errorMessage(error, "Unable to save the component.") });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FullPageLoading text="Loading component..." />;

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title={isNew ? "New Knowledge Category Component" : "Edit Knowledge Category Component"}
        breadcrumbItems={isNew ? knowledgeComponentCreate(navigate) : knowledgeComponentEdit(navigate, component?.name)}
        actions={
          <>
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={goBack}>Back</Button>
            {canManage && (
              <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" disabled={!canSave} onClick={() => void save()}>
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
          </>
        }
      />

      <FormSection
        title="General"
        icon={<Info className="h-4 w-4" />}
        headerRight={component?.systemDefined ? <Badge size="sm" color="blue">System</Badge> : undefined}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Name <span className="text-red-500">*</span></label>
              <input className={inputClass} value={name} maxLength={200} disabled={!canManage} onChange={(e) => setName(e.target.value)} />
            </div>
            {isNew ? (
              <Select
                label={<>Source Field <span className="text-red-500">*</span></>}
                value={sourceField}
                onChange={(value) => {
                  const next = String(value);
                  const previousLabel = sources.find((s) => s.value === sourceField)?.label;
                  setSourceField(next);
                  // Pre-fill the name from the chosen field unless the administrator already typed their own.
                  if (!name.trim() || name === previousLabel) setName(sources.find((s) => s.value === next)?.label ?? "");
                }}
                options={sources.map((s) => ({ label: s.label, value: s.value }))}
                disabled={!canManage}
                placeholder={sources.length === 0 ? "Every source field already has a component" : "Select a source field..."}
              />
            ) : (
              <div>
                <label className={labelClass}>Source Field</label>
                <input className={inputClass} value={component?.sourceLabel ?? ""} disabled readOnly />
                <p className="text-xs text-slate-500 mt-1.5">The source field of a component cannot be changed.</p>
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 resize-none"
              rows={3} value={description} disabled={!canManage} onChange={(e) => setDescription(e.target.value)}
            />
            {isNew && sourceField && (
              <p className="text-xs text-slate-500 mt-1.5">
                {sources.find((s) => s.value === sourceField)?.determinatorEligible
                  ? `"${sourceLabel}" can be used both as a Knowledge Base determinator and as a level.`
                  : `"${sourceLabel}" can be used as a level only.`}
              </p>
            )}
          </div>
          <div>
            <Checkbox id="knowledge-component-active" label="Active" checked={active} onChange={setActive} disabled={!canManage} />
            {!isNew && component && component.usedByHierarchies > 0 && (
              <p className="text-xs text-slate-500 mt-1.5">Used by {component.usedByHierarchies} hierarchy(ies): it cannot be deactivated or deleted until it is removed from them.</p>
            )}
          </div>
        </div>
      </FormSection>
    </div>
  );
};
