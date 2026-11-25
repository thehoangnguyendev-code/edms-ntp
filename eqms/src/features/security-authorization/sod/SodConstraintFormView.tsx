import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useFormDirty } from "@/hooks/useFormDirty";
import React, { useEffect, useState } from "react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Ban, Shield, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormSection } from "@/components/ui/form/FormSection";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { Select, type SelectOptionGroup } from "@/components/ui/select/Select";
import { Badge } from "@/components/ui/badge/Badge";
import { useToast } from "@/components/ui/toast/Toast";
import { cn } from "@/components/ui/utils";
import { settingsApi } from "@/services/api";
import type { SodConstraintResponse, SodConstraintPayload, SodViolationResponse } from "@/services/api/settings";
import { segregationOfDuties as segregationOfDutiesBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { usePermissionCatalog } from "@/features/security-authorization/shared/usePermissionCatalog";
import { useDebounce } from "@/hooks";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { IconInfoCircle, IconSettingsAutomation } from "@tabler/icons-react";
import { tr, trFormat } from "@/i18n";

const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const inputClass =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400";
const textareaClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 resize-none";

const VIEW_PERM = "security.sod.view";
const MANAGE_PERM = "security.sod.manage";

export const SodConstraintFormView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias(MANAGE_PERM);
  const { requestSignature, signatureModal } = useSecurityESign();
  const { permissionGroups, isLoading: catalogLoading } = usePermissionCatalog();

  /** One grouped-options list per side, excluding whatever is selected on the OTHER side (a
   *  permission cannot conflict with itself). Reuses the app-wide searchable Select instead of a
   *  bespoke scrollable table. */
  const buildGroups = (excludeCode: string): SelectOptionGroup[] =>
    permissionGroups
      .map((group) => ({
        groupLabel: group.name,
        options: group.permissions
          .filter((p) => p.id !== excludeCode)
          .map((p) => ({
            label: p.label,
            value: p.id,
            icon: <span className="text-2xs text-slate-400 font-mono">{p.id}</span>,
          })),
      }))
      .filter((g) => g.options.length > 0);

  const [initial, setInitial] = useState<SodConstraintResponse | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [name, setName] = useState("");
  const [codeA, setCodeA] = useState("");
  const [codeB, setCodeB] = useState("");
  const [severity, setSeverity] = useState<"WARN" | "BLOCK">("WARN");
  const [regulationRef, setRegulationRef] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  // Errors show only after the first Save; each one clears as soon as its field is valid.
  const [submitted, setSubmitted] = useState(false);
  // Real duplicate-pair check against existing constraints -- null while checking/no pair
  // selected, undefined once checked and no duplicate found, otherwise the existing constraint.
  const [duplicateConstraint, setDuplicateConstraint] = useState<SodConstraintResponse | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Real-world impact preview: which Access Profiles/users currently hold BOTH sides of the
  // selected pair, computed server-side (server always re-checks its own EligibilityResult-style
  // logic -- this preview is a UI hint for the admin, never itself an authorization decision).
  const [impact, setImpact] = useState<SodViolationResponse | null>(null);
  const [checkingImpact, setCheckingImpact] = useState(false);
  const debouncedCodeA = useDebounce(codeA, 300);
  const debouncedCodeB = useDebounce(codeB, 300);
  useEffect(() => {
    if (!debouncedCodeA || !debouncedCodeB || debouncedCodeA === debouncedCodeB) {
      setImpact(null);
      return;
    }
    let cancelled = false;
    setCheckingImpact(true);
    settingsApi
      .previewSodImpact(debouncedCodeA, debouncedCodeB)
      .then((result) => {
        if (!cancelled) setImpact(result);
      })
      .catch(() => {
        if (!cancelled) setImpact(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingImpact(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedCodeA, debouncedCodeB]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    settingsApi
      .getSodConstraint(id)
      .then((c) => {
        if (cancelled) return;
        setInitial(c);
        setName(c.name);
        setCodeA(c.permissionCodeA);
        setCodeB(c.permissionCodeB);
        setSeverity(c.severity);
        setRegulationRef(c.regulationRef ?? "");
        setActive(c.active);
      })
      .catch(() => {
        if (!cancelled) showToast({ type: "error", message: tr("Failed to load SoD constraint") });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, showToast]);

  // Real check: does an active constraint already exist for this exact permission pair
  // (in either order)? Prevents defining a redundant/duplicate SoD rule, which is the only
  // thing this form can actually detect client-side -- it has no visibility into who
  // currently holds which permissions, so it cannot judge real-world "conflict" risk.
  useEffect(() => {
    if (!codeA || !codeB || codeA === codeB) {
      setDuplicateConstraint(null);
      return;
    }
    let cancelled = false;
    setCheckingDuplicate(true);
    settingsApi
      .checkSodPermissions([codeA, codeB])
      .then((matches) => {
        if (cancelled) return;
        const dup = matches.find((m) => m.id !== initial?.id) ?? null;
        setDuplicateConstraint(dup);
      })
      .catch(() => {
        if (!cancelled) setDuplicateConstraint(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingDuplicate(false);
      });
    return () => {
      cancelled = true;
    };
  }, [codeA, codeB, initial?.id]);

  // Leaving with a change that was not saved asks first (Back, the breadcrumb, the sidebar, a reload); the move after a successful Save is not a leave.
  const { isDirty } = useFormDirty({ name, codeA, codeB, severity, regulationRef, active }, !loading);
  const { go, modal: leaveModal } = useLeaveGuard(isDirty, isEdit ? "Edit SoD Constraint" : "New SoD Constraint", "the previous page");
  const handleBack = () => navigateBack(go, location.state, ROUTES.SECURITY.SOD);
  const leaveAfterSave = () => navigateBack(navigate, location.state, ROUTES.SECURITY.SOD);

  const isSystem = Boolean(initial?.system);

  const errors = {
    codeA: codeA.trim() ? "" : "Select Permission A.",
    codeB: !codeB.trim() ? "Select Permission B." : codeA.trim() === codeB.trim() ? tr("Permission B must be different from Permission A.") : "",
    name: name.trim() ? "" : tr("Enter a name for this constraint."),
  };
  const shown = {
    codeA: submitted ? errors.codeA : "",
    codeB: submitted ? errors.codeB : "",
    name: submitted ? errors.name : "",
  };

  const handleSave = async () => {
    setSubmitted(true);
    const firstInvalid = (["codeA", "codeB", "name"] as const).find((field) => errors[field]);
    if (firstInvalid) {
      document.getElementById(`sod-field-${firstInvalid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const sig = await requestSignature(isEdit ? "Update SoD Constraint" : "Create SoD Constraint", "SoD Rule Change");
    if (!sig) return;
    setSaving(true);
    const payload: SodConstraintPayload = {
      name: name.trim(),
      permissionCodeA: codeA.trim(),
      permissionCodeB: codeB.trim(),
      severity,
      regulationRef: regulationRef.trim() || undefined,
      active,
    };
    try {
      if (initial) {
        await settingsApi.updateSodConstraint(initial.id, payload, sig);
        showToast({ type: "success", message: "Constraint updated" });
      } else {
        await settingsApi.createSodConstraint(payload, sig);
        showToast({ type: "success", message: "Constraint created" });
      }
      leaveAfterSave();
    } catch (e: any) {
      showToast({ type: "error", message: e?.response?.data?.message ?? "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <FullPageLoading text="Loading SoD constraint..." />;
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="text-lg font-semibold">{tr("Access Denied")}</p>
        <p className="text-sm">{tr("You do not have permission to manage Segregation of Duties constraints.")}</p>
      </div>
    );
  }

  const title = isEdit ? "Edit SoD Constraint" : "New SoD Constraint";

  const pairChosen = Boolean(codeA && codeB && codeA !== codeB);
  const noOneFlagged = !impact || (impact.violatingAccessProfiles.length === 0 && impact.violatingUserCombinations.length === 0);

  const impactBlock = () => (
    <div>
      {checkingImpact ? (
        <p className="text-sm text-slate-500">{tr("Checking who currently holds both permissions...")}</p>
      ) : noOneFlagged ? (
        <p className="text-sm text-slate-500">
          {tr("No active Access Profile or user currently holds both permissions — this rule would not flag anyone today.")}
        </p>
      ) : (
        <div className="space-y-3">
          {severity === "BLOCK" && (
            <WarningBanner variant="warning">
              {tr("They keep their access, but no further profile can be assigned to them until the conflict is removed.")}
            </WarningBanner>
          )}
          {impact && impact.violatingAccessProfiles.length > 0 && (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500">
                        {trFormat("{count} Access Profiles grant both sides", { count: impact.violatingAccessProfiles.length })}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {impact.violatingAccessProfiles.map((p) => (
                  <Badge key={p.accessProfileId} color="blue" size="xs">{p.accessProfileName}</Badge>
                ))}
              </div>
            </div>
          )}
          {impact && impact.violatingUserCombinations.length > 0 && (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500">
                        {trFormat("{count} users hold both via combined profiles", { count: impact.violatingUserCombinations.length })}
              </p>
              <ul className="mt-1.5 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {impact.violatingUserCombinations.map((c) => (
                  <li key={c.userId} className="flex items-center gap-3 px-3 py-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {(c.fullName ?? c.username).split(" ").filter(Boolean).slice(-2).map((w) => w[0]).join("").toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 break-words text-sm font-medium text-slate-900">{c.fullName ?? c.username}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const nameField = (
    <div id="sod-field-name" className="min-w-0">
      <label className={labelClass}>
        {tr("Name")} <span className="text-red-500">*</span>
      </label>
      <input
        className={cn(inputClass, shown.name && "border-red-500 focus:border-red-500 focus:ring-red-500")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={tr("e.g. Create vs Approve Revision")}
        disabled={isSystem}
        aria-invalid={Boolean(shown.name)}
      />
      {shown.name && <p role="alert" className="mt-1.5 text-xs text-red-600">{shown.name}</p>}
    </div>
  );
  const regField = (
    <div className="min-w-0">
      <label className={labelClass}>{tr("Regulation Reference")}</label>
      <input
        className={inputClass}
        value={regulationRef}
        onChange={(e) => setRegulationRef(e.target.value)}
        placeholder={tr("EU-GMP Chapter 4 §4.2 · 21 CFR 211.68(b)")}
        disabled={isSystem}
      />
      <p className="mt-1.5 text-xs text-slate-500">{tr("Shown to reviewers next to every violation of this rule.")}</p>
    </div>
  );
  const permField = (label: string, code: string, setCode: (value: string) => void, excludeCode: string, field: "codeA" | "codeB") => (
    <div id={`sod-field-${field}`} className="min-w-0">
      <Select
        label={`${label} *`}
        value={code}
        onChange={(v) => setCode(String(v))}
        groups={buildGroups(excludeCode)}
        options={[]}
        placeholder={tr("Search and select a permission...")}
        searchPlaceholder={tr("Search permission...")}
        disabled={isSystem}
        isLoading={catalogLoading}
        maxVisibleRows={8}
      />
      {shown[field] && <p role="alert" className="mt-1.5 text-xs text-red-600">{shown[field]}</p>}
    </div>
  );
  const activeField = <Checkbox checked={active} onChange={setActive} label={tr("Active")} />;
  const profileCount = impact?.violatingAccessProfiles.length ?? 0;
  const userCount = impact?.violatingUserCombinations.length ?? 0;
  const severityCards = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {(["WARN", "BLOCK"] as const).map((s) => {
        const selected = severity === s;
        const tone = s === "WARN" ? "amber" : "red";
        return (
          <button
            key={s}
            type="button"
            onClick={() => setSeverity(s)}
            disabled={isSystem}
            aria-pressed={selected}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed",
              selected
                ? tone === "amber" ? "border-amber-500 bg-amber-50" : "border-red-500 bg-red-50"
                : "border-slate-200 bg-white hover:border-slate-300",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              {s === "WARN" ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <Ban className="h-4 w-4 text-red-600" />}
              {s === "WARN" ? "Warn" : "Block"}
            </span>
            <span className="mt-1.5 block text-xs leading-5 text-slate-600">
              {s === "WARN"
                ? tr("Allowed, but the person is listed in SoD Violation Review.")
                : tr("Stops a new assignment that would give one person both permissions.")}
              {pairChosen && !checkingImpact && (profileCount > 0 || userCount > 0) && (
                <span className="mt-1 block font-medium text-slate-700">
                  {s === "WARN"
                    ? `${profileCount} profile${profileCount === 1 ? "" : "s"} and ${userCount} user${userCount === 1 ? "" : "s"} would be listed today.`
                    : tr("Those already holding both keep access; nobody new can be given both.")}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
  const dupNotice =
    pairChosen && !checkingDuplicate && duplicateConstraint ? (
      <WarningBanner variant="error">
        {tr("Duplicate:")} {trFormat("an active constraint for this exact permission pair already exists — \"{name}\" ({severity}). Edit that constraint instead of creating a second one.", { name: duplicateConstraint.name, severity: duplicateConstraint.severity })}
      </WarningBanner>
    ) : null;
  const saveDisabled = saving || (isSystem && active === initial?.active);
  const cancelButton = (
    <Button variant="outline-emerald" size="sm" onClick={handleBack} className="whitespace-nowrap">{tr("Cancel")}</Button>
  );
  const saveButton = (
    <Button variant="outline-emerald" size="sm" onClick={() => void handleSave()} disabled={saveDisabled} className="whitespace-nowrap">
      {saving ? "Saving…" : "Save"}
    </Button>
  );
  const footerBar = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-start">
      {cancelButton}
      {saveButton}
    </div>
  );
  const shell = (body: React.ReactNode) => (
    <div className="flex flex-col gap-4 md:gap-6">
      {signatureModal}
      <PageHeader
        title={title}
        breadcrumbItems={segregationOfDutiesBreadcrumb(go, title)}
        actions={
          <div className="flex items-center gap-2">
            {cancelButton}
            {saveButton}
          </div>
        }
      />
      {isSystem && (
        <WarningBanner variant="info">{tr("This is a system-defined constraint. Its definition cannot be modified or deleted; it can only be activated or deactivated.")}</WarningBanner>
      )}
      {body}
      {leaveModal}
    </div>
  );

  // Pick the pair, see who it touches, then decide the severity knowing the numbers
  const statTile = (value: number, label: string) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-2xl font-semibold text-slate-900">{checkingImpact ? "…" : value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
  const body = (
    <div className="space-y-4 md:space-y-6">
      <FormSection title={tr("1. Pick The Two Permissions")} icon={<Ban className="h-4 w-4" />} contentClassName="space-y-4 p-4 md:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {permField("Permission A", codeA, setCodeA, codeB, "codeA")}
          {permField("Permission B", codeB, setCodeB, codeA, "codeB")}
        </div>
        {dupNotice}
      </FormSection>
      <FormSection title={tr("2. Who This Touches Today")} icon={<Users className="h-4 w-4" />} contentClassName="space-y-4 p-4 md:p-5">
        {pairChosen ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {statTile(profileCount, tr("Access Profiles grant both"))}
              {statTile(userCount, tr("Users hold both through combined profiles"))}
            </div>
            {impactBlock()}
          </>
        ) : (
          <WarningBanner variant="info">{tr("Choose two different permissions to see who would conflict today.")}</WarningBanner>
        )}
      </FormSection>
      <FormSection title={tr("3. Decide What The System Does")} icon={<IconSettingsAutomation className="h-4 w-4" />} contentClassName="space-y-4 p-4 md:p-5">
        {severityCards}
        {activeField}
      </FormSection>
      <FormSection title={tr("4. Name it")} icon={<IconInfoCircle className="h-4 w-4" />} contentClassName="p-4 md:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {nameField}
          {regField}
        </div>
      </FormSection>
      {footerBar}
    </div>
  );

  return shell(body);
};
