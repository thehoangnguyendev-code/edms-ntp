import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Ban, Shield, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormSection } from "@/components/ui/form/FormSection";
import { FullPageLoading, InlineLoading } from "@/components/ui/loading/Loading";
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

  const permissionRows = useMemo(
    () => permissionGroups.flatMap((group) => group.permissions.map((permission) => ({ ...permission, groupName: group.name }))),
    [permissionGroups],
  );

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
        if (!cancelled) showToast({ type: "error", message: "Failed to load SoD constraint" });
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

  const handleBack = () => navigateBack(navigate, location.state, ROUTES.SECURITY.SOD);

  const isSystem = Boolean(initial?.system);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast({ type: "error", title: "Validation failed", message: "Name is required" });
      return;
    }
    if (!codeA.trim() || !codeB.trim()) {
      showToast({ type: "error", title: "Validation failed", message: "Both permission codes are required" });
      return;
    }
    if (codeA.trim() === codeB.trim()) {
      showToast({ type: "error", title: "Validation failed", message: "Permission codes must be different" });
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
      handleBack();
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
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm">You do not have permission to manage Segregation of Duties constraints.</p>
      </div>
    );
  }

  const title = isEdit ? "Edit SoD Constraint" : "New SoD Constraint";

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {signatureModal}
      <PageHeader
        title={title}
        breadcrumbItems={segregationOfDutiesBreadcrumb(navigate, title)}
        actions={
          <>
            <Button variant="outline-emerald" size="sm" onClick={handleBack} className="whitespace-nowrap">
              Cancel
            </Button>
            <Button size="sm" variant="outline-emerald" onClick={() => void handleSave()} disabled={saving || (isSystem && active === initial?.active)} className="whitespace-nowrap">
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      {isSystem && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
          This is a system-defined constraint. Its definition cannot be modified or deleted; it can only be activated or deactivated.
        </div>
      )}

      <FormSection
        title="Constraint Identity"
        icon={<IconInfoCircle className="h-4 w-4" />}
        contentClassName="p-4 md:p-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className={labelClass}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Create vs Approve Revision"
              disabled={isSystem}
              autoFocus
            />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Regulation Reference</label>
            <input
              className={inputClass}
              value={regulationRef}
              onChange={(e) => setRegulationRef(e.target.value)}
              placeholder="EU-GMP Chapter 4 §4.2 · 21 CFR 211.68(b)"
              disabled={isSystem}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Conflicting Permission Pair"
        icon={<Ban className="h-4 w-4" />}
        contentClassName="p-4 md:p-5 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Permission A"
            value={codeA}
            onChange={(v) => setCodeA(String(v))}
            groups={buildGroups(codeB)}
            options={[]}
            placeholder="Search and select a permission..."
            searchPlaceholder="Search permission..."
            disabled={isSystem}
            isLoading={catalogLoading}
            maxVisibleRows={8}
          />
          <Select
            label="Permission B"
            value={codeB}
            onChange={(v) => setCodeB(String(v))}
            groups={buildGroups(codeA)}
            options={[]}
            placeholder="Search and select a permission..."
            searchPlaceholder="Search permission..."
            disabled={isSystem}
            isLoading={catalogLoading}
            maxVisibleRows={8}
          />
        </div>

        {codeA && codeB && checkingDuplicate && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Checking for an existing constraint on this pair...
          </div>
        )}
        {codeA && codeB && !checkingDuplicate && duplicateConstraint && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span className="font-semibold">Duplicate:</span> an active constraint for this exact permission pair
            already exists — "{duplicateConstraint.name}" ({duplicateConstraint.severity}).
            Edit that constraint instead of creating a second one for the same pair.
          </div>
        )}
        {codeA && codeB && !checkingDuplicate && !duplicateConstraint && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            This rule will flag any user or Access Profile holding both{" "}
            <span className="font-semibold">{permissionRows.find((p) => p.id === codeA)?.label ?? codeA}</span> and{" "}
            <span className="font-semibold">{permissionRows.find((p) => p.id === codeB)?.label ?? codeB}</span> as a
            Segregation of Duties {severity === "BLOCK" ? "violation to block" : "warning"}.
          </div>
        )}

        {codeA && codeB && codeA !== codeB && (
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <Users className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-800">Real-world impact preview</span>
              {checkingImpact && <InlineLoading size="sm" className="ml-auto" />}
            </div>
            <div className="p-4">
              {checkingImpact ? (
                <p className="text-sm text-slate-500">Checking who currently holds both permissions...</p>
              ) : !impact || (impact.violatingAccessProfiles.length === 0 && impact.violatingUserCombinations.length === 0) ? (
                <p className="text-sm text-slate-500">
                  No active Access Profile or user currently holds both permissions — this rule would not flag anyone today.
                </p>
              ) : (
                <div className="space-y-3">
                  {impact.violatingAccessProfiles.length > 0 && (
                    <div>
                      <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500">
                        {impact.violatingAccessProfiles.length} Access Profile{impact.violatingAccessProfiles.length === 1 ? "" : "s"} grant both sides:
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {impact.violatingAccessProfiles.map((p) => (
                          <Badge key={p.accessProfileId} color="slate" variant="outline" size="xs">{p.accessProfileName}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {impact.violatingUserCombinations.length > 0 && (
                    <div>
                      <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500">
                        {impact.violatingUserCombinations.length} user{impact.violatingUserCombinations.length === 1 ? "" : "s"} hold both via combined profiles:
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {impact.violatingUserCombinations.map((c) => (
                          <Badge key={c.userId} color="amber" variant="outline" size="xs">{c.fullName ?? c.username}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </FormSection>

      <FormSection
        title="Enforcement Settings"
        icon={<IconSettingsAutomation className="h-4 w-4" />}
        description="Choose how the system should handle this conflict."
        contentClassName="p-4 md:p-5"
      >
        <div className="flex flex-col gap-4">
            <div className="max-w-md">
              <label className={labelClass}>Severity</label>
              <div className="flex gap-2">
                {(["WARN", "BLOCK"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    disabled={isSystem}
                    className={cn(
                      "flex flex-1 h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors",
                      severity === s
                        ? s === "WARN"
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "bg-red-600 border-red-600 text-white"
                        : "border-slate-200 text-slate-600 hover:border-slate-300",
                    )}
                  >
                    {s === "WARN"
                      ? <AlertTriangle className="h-3.5 w-3.5" />
                      : <Ban className="h-3.5 w-3.5" />}
                    {s}
                  </button>
                ))}
              </div>
            </div>
          <div className="self-start">
            <Checkbox checked={active} onChange={setActive} label="Active" />
          </div>
        </div>
      </FormSection>
    </div>
  );
};
