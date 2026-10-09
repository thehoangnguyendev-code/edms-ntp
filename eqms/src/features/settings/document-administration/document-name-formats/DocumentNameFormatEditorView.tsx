import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, FileSignature, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { documentNameFormatApi } from "@/services/api";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { documentNameFormatCreate, documentNameFormatEdit } from "@/components/ui/breadcrumb/breadcrumbs.config";
import type { DocumentComponentItem, DocumentNameFormatItem } from "./documentNameFormatTypes";
import { IconInfoCircle } from "@tabler/icons-react";
import { cn } from "@/components/ui/utils";

const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const inputClass =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400";
const textareaClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 resize-none";

type BuilderComponent = { componentId: string; name: string; value: string };

/** Full in-progress editor state, carried via router `state` across the round-trip to the
 *  dedicated "New Document Component" page and back, so navigating there and back never loses
 *  unsaved work on the Format being edited. */
interface FormatDraft {
  name: string;
  separator: string;
  description: string;
  descriptionTouched: boolean;
  isActive: boolean;
  selected: BuilderComponent[];
}

interface FormatEditorNavState {
  draft?: FormatDraft;
  newComponent?: { id: string; name: string; value: string };
}

/**
 * Full-page create/edit for a Document Name Format. Was a FormModal until the component-order
 * builder made a page a better fit (Document Name Formats now mirrors Publishing Templates'
 * editor-page pattern rather than the simpler dictionaries' inline-modal one).
 */
export const DocumentNameFormatEditorView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navState = location.state as FormatEditorNavState | null;
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("documents.admin.name_formats.manage");
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [name, setName] = useState("");
  const [separator, setSeparator] = useState(".");
  const [description, setDescription] = useState("");
  // True once the admin has typed their own Description -- stops the auto-suggestion below from
  // overwriting it. Resets to false if they clear the field back to empty, so auto-suggest
  // resumes rather than leaving them stuck with a blank description forever.
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [selected, setSelected] = useState<BuilderComponent[]>([]);
  const [availableComponents, setAvailableComponents] = useState<DocumentComponentItem[]>([]);
  // What the server last returned (Edit only). Save stays disabled until the form differs from it;
  // null means there is nothing to compare with (New, or an edit restored from an unsaved draft).
  const [baseline, setBaseline] = useState<string | null>(null);
  const snapshotOf = (v: { name: string; separator: string; description: string; isActive: boolean; ids: string[] }) => JSON.stringify(v);

  const loadComponents = () => documentNameFormatApi.getComponents().then(setAvailableComponents);

  useEffect(() => {
    loadComponents();
  }, []);

  useEffect(() => {
    // Returning from the "New Document Component" page (see handleOpenNewComponent below) --
    // restore exactly what was being edited instead of re-fetching from the server, and fold in
    // the just-created component if one came back. Skips the network round-trip entirely.
    if (navState?.draft) {
      const d = navState.draft;
      let nextSelected = d.selected;
      if (navState.newComponent && !nextSelected.some((c) => c.componentId === navState.newComponent!.id)) {
        const nc = navState.newComponent;
        nextSelected = [...nextSelected, { componentId: nc.id, name: nc.name, value: nc.value }];
      }
      setName(d.name);
      setSeparator(d.separator);
      setDescription(d.description);
      setDescriptionTouched(d.descriptionTouched);
      setIsActive(d.isActive);
      setSelected(nextSelected);
      setIsLoading(false);
      return;
    }

    if (!isEdit || !id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(false);
    documentNameFormatApi
      .getFormat(id)
      .then((item: DocumentNameFormatItem) => {
        setName(item.name);
        setSeparator(item.separator ?? "");
        setDescription(item.description || "");
        setIsActive(item.isActive);
        const ordered = [...item.components]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((c) => ({ componentId: c.componentId, name: c.name, value: c.value }));
        setSelected(ordered);
        setBaseline(snapshotOf({
          name: item.name,
          separator: item.separator ?? "",
          description: item.description || "",
          isActive: item.isActive,
          ids: ordered.map((c) => c.componentId),
        }));
      })
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // Auto-suggest Description from the selected Components, e.g.
  // "Format: <Document Type>_<Department Code>_<Serial Number>" -- only while the admin hasn't
  // typed their own text (see descriptionTouched above). Debounced so rapid add/remove/reorder
  // clicks settle before the text updates. The very first run (data just loaded, or the initial
  // empty state for a new format) is skipped so opening Edit never silently overwrites an
  // existing description just from viewing the page -- only an actual Components change during
  // this session triggers the update.
  const skippedInitialRunRef = React.useRef(false);
  useEffect(() => {
    if (isLoading) return;
    if (!skippedInitialRunRef.current) {
      skippedInitialRunRef.current = true;
      return;
    }
    if (descriptionTouched) return;
    const timer = setTimeout(() => {
      if (selected.length === 0) {
        setDescription("");
        return;
      }
      const tokens = selected.map((c) => `<${c.name}>`).join(separator || "");
      setDescription(`Format: ${tokens}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [selected, separator, isLoading, descriptionTouched]);

  const goBack = () => navigate(ROUTES.DOCUMENTS.ADMIN.NAME_FORMATS);

  // Navigates to the dedicated "New Document Component" page, carrying the current in-progress
  // edit as router state so it can be restored on return (see the draft-hydration effect above)
  // instead of losing it -- the modal this replaced added the new component inline without ever
  // leaving this page.
  const handleOpenNewComponent = () => {
    const draft: FormatDraft = { name, separator, description, descriptionTouched, isActive, selected };
    navigate(ROUTES.DOCUMENTS.ADMIN.DOCUMENT_COMPONENTS_NEW, {
      state: { returnTo: location.pathname, draft },
    });
  };

  // Shows every active component, checkmark reflecting what's already in `selected` -- unlike a
  // one-shot "pick and vanish" list, checked items stay visible and checked so this actually
  // behaves like a MultiSelect (tick several without the dropdown reshuffling under you).
  const pickerOptions = availableComponents
    .filter((c) => c.isActive)
    .map((c) => ({ label: `${c.name} ({{${c.value}}})`, value: c.id }));
  const pickerValue = selected.map((c) => c.componentId);

  const handlePickComponents = (values: (string | number)[]) => {
    const valueIds = values.map(String);
    const valueSet = new Set(valueIds);
    // Keep existing order for components that are still checked; drop ones just unchecked.
    const kept = selected.filter((c) => valueSet.has(c.componentId));
    const keptIds = new Set(kept.map((c) => c.componentId));
    // Newly checked components (in the order MultiSelect reports them) get appended at the end.
    const added = valueIds
      .filter((id) => !keptIds.has(id))
      .map((id) => availableComponents.find((c) => c.id === id))
      .filter((c): c is DocumentComponentItem => Boolean(c))
      .map((c) => ({ componentId: c.id, name: c.name, value: c.value }));
    setSelected([...kept, ...added]);
  };

  const moveComponent = (index: number, direction: -1 | 1) => {
    setSelected((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeComponent = (index: number) => {
    setSelected((prev) => prev.filter((_, i) => i !== index));
  };

  const previewSample = (value: string) =>
    availableComponents.find((c) => c.value === value)?.sampleValue || `{{${value}}}`;

  const preview = selected.map((c) => previewSample(c.value)).join(separator);

  const isDirty = baseline === null
    ? (isEdit ? true : Boolean(name.trim() || selected.length > 0 || description.trim()))
    : snapshotOf({ name, separator, description, isActive, ids: selected.map((c) => c.componentId) }) !== baseline;
  const canSubmit = name.trim().length > 0 && selected.length > 0 && isDirty && !isSaving;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name,
        separator,
        description,
        isActive,
        components: selected.map((c, index) => ({ componentId: c.componentId, displayOrder: (index + 1) * 10 })),
      };
      const saved = isEdit && id
        ? await documentNameFormatApi.updateFormat(id, payload)
        : await documentNameFormatApi.createFormat(payload);
      showToast({
        type: "success",
        title: isEdit ? "Document Name Format Updated" : "Document Name Format Created",
        message: `"${saved.name}" has been ${isEdit ? "updated" : "created"} successfully. Example: ${saved.previewExample || "-"}`,
      });
      goBack();
    } catch (error) {
      showToast({
        type: "error",
        title: isEdit ? "Update Failed" : "Create Failed",
        message: extractApiMessage(error, isEdit ? "Unable to update document name format." : "Unable to create document name format."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <PageHeader
        title={isEdit ? "Edit Document Name Format" : "New Document Name Format"}
        breadcrumbItems={isEdit ? documentNameFormatEdit(navigate, name || undefined) : documentNameFormatCreate(navigate)}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline-emerald" onClick={goBack} className="whitespace-nowrap">
              Back
            </Button>
            {canManage && (
              <Button size="sm" variant="outline-emerald" onClick={handleSave} disabled={!canSubmit} className="whitespace-nowrap">
                {isSaving ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <SectionLoading text="Loading document name format..." />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-amber-800">Unable to load this document name format.</p>
          <Button size="sm" variant="outline" onClick={goBack}>Back to list</Button>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-4 md:space-y-6 pb-6">
          <FormSection title="General" icon={<IconInfoCircle className="h-4 w-4" />} contentClassName="p-4 md:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Document Number Format"
                  disabled={isSaving || !canManage}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Separator <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value.slice(0, 10))}
                  className={cn(inputClass, "text-center")}
                  placeholder="."
                  maxLength={10}
                  disabled={isSaving || !canManage}
                />
                <p className="mt-1.5 text-xs text-slate-500">e.g. "." "-" "_"</p>
              </div>
              <div className="sm:col-span-3">
                <label className={labelClass}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDescription(value);
                    // Clearing it back to empty resumes auto-suggestion instead of leaving a
                    // permanently blank field once the admin has typed anything once.
                    setDescriptionTouched(value.trim().length > 0);
                  }}
                  rows={2}
                  className={textareaClass}
                  placeholder="Auto-suggested from the components below — edit anytime"
                  disabled={isSaving || !canManage}
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Follows the Components list below until you type your own text. Clear it to resume auto-suggesting.
                </p>
              </div>
              <div className="sm:col-span-3">
                <Checkbox id="isActive doc-name-format-page" checked={isActive} onChange={setIsActive} label="Active" disabled={isSaving || !canManage} />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Components"
            description="Add components in the order they should appear. Use the arrows to reorder."
            contentClassName="p-4 md:p-5"
            headerRight={
              canManage && (
                <Button type="button" variant="default" size="sm" onClick={handleOpenNewComponent} className="gap-1.5 whitespace-nowrap shrink-0">
                  <Plus className="h-3.5 w-3.5" />
                  New Component
                </Button>
              )
            }
          >
            {selected.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-4">
                {selected.map((component, index) => (
                  <div key={component.componentId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xs font-semibold text-slate-500">
                      {index + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">{component.name}</span>
                      <code className="text-2xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 whitespace-nowrap">{"{{" + component.value + "}}"}</code>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveComponent(index, -1)}
                        disabled={index === 0 || !canManage}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <ArrowUp className="h-3.5 w-3.5 text-slate-500" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveComponent(index, 1)}
                        disabled={index === selected.length - 1 || !canManage}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <ArrowDown className="h-3.5 w-3.5 text-slate-500" />
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => removeComponent(index)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canManage && (
              <MultiSelect
                value={pickerValue}
                onChange={handlePickComponents}
                options={pickerOptions}
                placeholder="Select components to add..."
                searchPlaceholder="Search components..."
              />
            )}

            {selected.length > 0 && (
              <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-xs sm:text-sm font-medium text-emerald-700 mb-1">Preview</p>
                <p className="text-sm text-emerald-900 break-all">{preview}</p>
              </div>
            )}
          </FormSection>
        </div>
      )}
    </div>
  );
};
