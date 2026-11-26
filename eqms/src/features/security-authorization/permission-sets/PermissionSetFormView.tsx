import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useFormDirty } from "@/hooks/useFormDirty";
import React, { useEffect, useMemo, useState } from "react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Info, KeyRound, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form/FormSection";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { PermissionSplitExplorer } from "@/features/security-authorization/shared/explorer/PermissionSplitExplorer";
import { usePermissionCatalog } from "@/features/security-authorization/shared/usePermissionCatalog";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { permissionSets as permissionSetsBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { settingsApi } from "@/services/api";
import type { PermissionSetResponse } from "@/services/api/settings";
import { tr, getCatalogLanguage } from "@/i18n";

const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const inputClass =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400";
const textareaClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 resize-none";

export const PermissionSetFormView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { requestSignature, signatureModal } = useSecurityESign();
  const isEdit = Boolean(id);

  const { permissionGroups, isLoading: catalogLoading } = usePermissionCatalog();

  const [source, setSource] = useState<PermissionSetResponse | null>(null);
  const [loadingSource, setLoadingSource] = useState(isEdit);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // Errors show only after the first Save; each one clears as soon as its field is valid.
  const [submitted, setSubmitted] = useState(false);

  // Leaving with a change that was not saved asks first (Back, the breadcrumb, the sidebar, a reload); the move after a successful Save is not a leave.
  const { isDirty } = useFormDirty({ name, code, description, active, permissions: [...selectedCodes].sort() }, !(isEdit && loadingSource));
  const { go, modal: leaveModal } = useLeaveGuard(isDirty, isEdit ? tr("Edit Shared Permission Set") : tr("New Shared Permission Set"), "the previous page");

  useEffect(() => {
    if (!isEdit || !id) return;
    setLoadingSource(true);
    settingsApi
      .getPermissionSet(id)
      .then((ps) => {
        setSource(ps);
        setName(ps.name);
        setCode(ps.code);
        setDescription(ps.description ?? "");
        setActive(ps.active);
        setSelectedCodes(new Set(ps.permissionCodes));
      })
      .catch(() => showToast({ type: "error", message: "Failed to load permission set" }))
      .finally(() => setLoadingSource(false));
  }, [id, isEdit, showToast]);

  const handleBack = () => navigateBack(go, location.state, ROUTES.SECURITY.PERMISSION_SETS);

  const handleToggle = (permCode: string, checked: boolean) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permCode);
      else next.delete(permCode);
      return next;
    });
  };

  const errors = {
    name: name.trim() ? "" : tr("Enter a name for this permission set."),
    permissions: selectedCodes.size > 0 ? "" : tr("Select at least one permission."),
  };
  const shown = { name: submitted ? errors.name : "", permissions: submitted ? errors.permissions : "" };

  const handleSave = async () => {
    setSubmitted(true);
    const firstInvalid = (["name", "permissions"] as const).find((field) => errors[field]);
    if (firstInvalid) {
      document.getElementById(`ps-field-${firstInvalid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const sig = await requestSignature(isEdit ? "Update Permission Set" : "Create Permission Set", "Permission Set Change");
    if (!sig) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: isEdit ? undefined : code.trim() || undefined,
        description: description.trim() || undefined,
        active,
        permissionCodes: [...selectedCodes],
      };
      if (isEdit && id) {
        await settingsApi.updatePermissionSet(id, payload, sig);
        showToast({ type: "success", message: "Permission set updated" });
        navigate(`${ROUTES.SECURITY.PERMISSION_SETS}/${id}`);
      } else {
        const created = await settingsApi.createPermissionSet(payload, sig);
        showToast({ type: "success", message: "Permission set created" });
        navigate(`${ROUTES.SECURITY.PERMISSION_SETS}/${created.id}`);
      }
    } catch (e: any) {
      showToast({ type: "error", message: e?.response?.data?.message ?? "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const breadcrumbItems = useMemo(() => {
    const base = permissionSetsBreadcrumb(go).slice(0, -1);
    return [
      ...base,
      { label: tr("Shared Permission Sets"), onClick: () => go(ROUTES.SECURITY.PERMISSION_SETS) },
      { label: isEdit ? tr("Edit Shared Permission Set") : tr("New Shared Permission Set"), isActive: true },
    ];
  }, [go, isEdit, source, getCatalogLanguage()]);

  if (isEdit && loadingSource) {
    return <FullPageLoading text="Loading permission set..." />;
  }

  const isSystemLocked = isEdit && source?.system;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {signatureModal}
      <PageHeader
        title={isEdit ? tr(`Edit Shared Permission Set`) : tr("New Shared Permission Set")}
        breadcrumbItems={breadcrumbItems}
        actions={
          <>
            <Button variant="outline-emerald" size="sm" onClick={handleBack} className="whitespace-nowrap">
              {tr("Cancel")}
            </Button>
            <Button size="sm" variant="outline-emerald" onClick={() => void handleSave()} disabled={saving || isSystemLocked} className="whitespace-nowrap">
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      {isSystemLocked && (
        <WarningBanner variant="warning">{tr("This is a system permission set. Its definition is protected and cannot be modified.")}</WarningBanner>
      )}

      <FormSection title={tr("Basic Information")} icon={<Info className="h-4 w-4" />} contentClassName="p-4 md:p-5">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div id="ps-field-name">
              <label className={labelClass}>
                {tr("Name")} <span className="text-red-500">*</span>
              </label>
              <input
                className={`${inputClass}${shown.name ? " border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr("e.g. Document Author")}
                disabled={isSystemLocked}
                aria-invalid={Boolean(shown.name)}
              />
              {shown.name && <p role="alert" className="mt-1.5 text-xs text-red-600">{shown.name}</p>}
            </div>
            <div>
              <label className={labelClass}>{tr("Code")}</label>
              <input
                className={
                  isEdit ? CONTROL_STATE_CLASSES.readonlyField : inputClass
                }
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={isEdit ? tr("Read-only for existing records") : "AUTO_GENERATED"}
                disabled={isEdit}
                readOnly={isEdit}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>{tr("Description")}</label>
            <textarea
              className={textareaClass}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr("Describe the responsibility scope of this permission set")}
              disabled={isSystemLocked}
            />
          </div>

          <div>
            <label className={labelClass}>{tr("Status")}</label>
            <Checkbox checked={active} onChange={setActive} label={tr("Active")} disabled={isSystemLocked} />
          </div>
        </div>
      </FormSection>

      <FormSection
        title={tr("Permissions")}
        icon={<ListChecks className="h-4 w-4" />}
        description={tr("Tick the permissions to include in this set. Grouped by module — search or filter to narrow down.")}
        contentClassName="p-4 md:p-5"
      >
        <div id="ps-field-permissions" className="mb-3 flex items-center gap-2">
          <Badge color="emerald" size="sm">
            {selectedCodes.size} {tr("selected")}
          </Badge>
          {shown.permissions && <span role="alert" className="text-xs text-red-600">{shown.permissions}</span>}
        </div>
        <PermissionSplitExplorer
          groups={permissionGroups}
          selectedCodes={selectedCodes}
          onToggle={handleToggle}
          readOnly={Boolean(isSystemLocked)}
          isLoading={catalogLoading}
        />
      </FormSection>
      {leaveModal}
    </div>
  );
};
