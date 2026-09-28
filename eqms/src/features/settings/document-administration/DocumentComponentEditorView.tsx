import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Lock, TextInitial } from "lucide-react";
import { IconInfoCircle } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { documentNameFormatApi } from "@/services/api";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { documentComponentCreate, documentComponentEdit } from "@/components/ui/breadcrumb/breadcrumbs.config";
import type { DocumentComponentFormData, DocumentComponentItem } from "./documentNameFormatTypes";

const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const inputClass =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed";

/**
 * Full-page create/edit for a Document Component. Mirrors DocumentNameFormatEditorView's
 * page-over-modal pattern -- the "Free Text Value" concept needs room for an explanation and a
 * live example, which a FormModal couldn't comfortably fit. Also reached from the "New Component"
 * shortcut inside the Document Name Format editor (that in-page modal was retired); when arriving
 * that way, `location.state.returnTo` carries the Format editor's in-progress draft so Back/Save
 * both return to it with nothing lost instead of dropping the admin at the Components list.
 *
 * Admins may only create/edit the Free Text kind here -- see DocumentComponent.java's class
 * javadoc for why field-bound components (Table/Field mapping) are backend-seeded only.
 */
export const DocumentComponentEditorView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("documents.admin.name_formats.manage");
  const { showToast } = useToast();
  const navState = location.state as { returnTo?: string; draft?: unknown } | null;

  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [item, setItem] = useState<DocumentComponentItem | null>(null);

  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [freeText, setFreeText] = useState("");
  const [isActive, setIsActive] = useState(true);

  const isSystemDefined = isEdit && !!item?.systemDefined;

  useEffect(() => {
    if (!isEdit || !id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(false);
    // No single-item GET exists for Document Components -- the unpaginated list (also used to
    // populate the Format builder's picker) already carries every field this page needs, so
    // reusing it avoids adding a redundant endpoint.
    documentNameFormatApi
      .getComponents()
      .then((items) => {
        const found = items.find((c) => c.id === id);
        if (!found) {
          setLoadError(true);
          return;
        }
        setItem(found);
        setName(found.name);
        setShortDescription(found.shortDescription || "");
        setFreeText(found.freeText || "");
        setIsActive(found.isActive);
      })
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false));
  }, [id, isEdit]);

  // Plain Back (nothing just created): hand the untouched draft straight back so the Format
  // editor restores exactly what it had.
  const goBack = () => {
    if (navState?.returnTo) {
      navigate(navState.returnTo, { state: { draft: navState.draft } });
      return;
    }
    navigate(ROUTES.DOCUMENTS.ADMIN.DOCUMENT_COMPONENTS);
  };

  const canSubmit =
    !isSaving && (isSystemDefined || (name.trim().length > 0 && freeText.trim().length > 0));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: DocumentComponentFormData = { name, shortDescription, freeText, isActive };
      const saved =
        isEdit && id
          ? await documentNameFormatApi.updateComponent(id, payload)
          : await documentNameFormatApi.createComponent(payload);
      showToast({
        type: "success",
        title: isEdit ? "Document Component Updated" : "Document Component Created",
        message: `"${saved.name}" has been ${isEdit ? "updated" : "created"} successfully.`,
      });
      if (navState?.returnTo) {
        // Fold the newly created component back into the Format being edited instead of
        // dropping the admin at the Components list.
        navigate(navState.returnTo, {
          state: { draft: navState.draft, newComponent: { id: saved.id, name: saved.name, value: saved.value } },
        });
        return;
      }
      goBack();
    } catch (error) {
      showToast({
        type: "error",
        title: isEdit ? "Update Failed" : "Create Failed",
        message: extractApiMessage(error, isEdit ? "Unable to update document component." : "Unable to create document component."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const previewValue = freeText.trim() || "REV";

  return (
    <div className="h-full flex flex-col gap-6">
      <PageHeader
        title={isEdit ? "Edit Document Component" : "New Document Component"}
        breadcrumbItems={isEdit ? documentComponentEdit(navigate, name || undefined) : documentComponentCreate(navigate)}
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
          <SectionLoading text="Loading document component..." />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-amber-800">Unable to load this document component.</p>
          <Button size="sm" variant="outline" onClick={goBack}>Back to list</Button>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-4 md:space-y-6 pb-6">
          {isSystemDefined && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-2.5">
              <Lock className="h-4 w-4 mt-0.5 flex-shrink-0 text-slate-400" />
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700">System-defined component</p>
                <p className="mt-1">
                  Bound to{" "}
                  <code className="bg-white border border-slate-200 rounded px-1 py-0.5 text-2xs">
                    {item?.sourceTable}.{item?.sourceField}
                  </code>{" "}
                  by the backend — its name, description and value source are fixed. Only the
                  Active status below can be changed.
                </p>
              </div>
            </div>
          )}

          <FormSection title="General" icon={<IconInfoCircle className="h-4 w-4" />} contentClassName="p-4 md:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  Name {!isSystemDefined && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Revision Tag"
                  disabled={isSaving || !canManage || isSystemDefined}
                  readOnly={isSystemDefined}
                />
              </div>
              <div>
                <label className={labelClass}>Short Description</label>
                <input
                  type="text"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className={inputClass}
                  placeholder="Shown next to the token in the Format builder"
                  disabled={isSaving || !canManage || isSystemDefined}
                  readOnly={isSystemDefined}
                />
              </div>
              <div className="sm:col-span-2">
                <Checkbox
                  id="isActive doc-component-page"
                  checked={isActive}
                  onChange={setIsActive}
                  label="Active"
                  disabled={isSaving || !canManage}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Free Text Value"
            icon={<TextInitial className="h-4 w-4" />}
            description="The literal, fixed text this component inserts wherever it's used in a Document Name Format."
            contentClassName="p-4 md:p-5"
          >
            {!isSystemDefined && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 mb-4 text-xs text-sky-900 space-y-2">
                <p>
                  <span className="font-semibold">What it is:</span> a fixed string you choose now
                  — not pulled from any document, user, or revision data. Every document created
                  under a Format that includes this component gets the exact same text, in the
                  exact position you place it.
                </p>
                <p>
                  <span className="font-semibold">When it applies:</span> only to new document
                  numbers/names generated after you save. Editing this value later never rewrites
                  documents already created — those keep whatever text was in effect at the time.
                </p>
                <p>
                  <span className="font-semibold">Example:</span> value{" "}
                  <code className="bg-white px-1 py-0.5 rounded border border-sky-200">"REV"</code>{" "}
                  used in a Format composed of <em>Document Type</em> + this component (separator
                  "-") renders every matching document as{" "}
                  <code className="bg-white px-1 py-0.5 rounded border border-sky-200">SOP-REV</code>,{" "}
                  <code className="bg-white px-1 py-0.5 rounded border border-sky-200">URS-REV</code>
                  , and so on — never anything document-specific.
                </p>
              </div>
            )}

            <label className={labelClass}>
              Free Text Value {!isEdit && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              className={inputClass}
              placeholder='Literal text this component inserts (e.g. "REV")'
              disabled={isSaving || !canManage || isSystemDefined}
              readOnly={isSystemDefined}
            />

            {!isSystemDefined && (
              <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-xs sm:text-sm font-medium text-emerald-700 mb-1">Preview — Document Type + this component, separator "-"</p>
                <p className="text-sm text-emerald-900">
                  SOP-{previewValue} &nbsp;·&nbsp; URS-{previewValue} &nbsp;·&nbsp; QM-{previewValue}
                </p>
              </div>
            )}
          </FormSection>
        </div>
      )}
    </div>
  );
};
