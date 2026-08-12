import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Ban, Search, Shield, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormSection } from "@/components/ui/form/FormSection";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { useToast } from "@/components/ui/toast/Toast";
import { cn } from "@/components/ui/utils";
import { settingsApi } from "@/services/api";
import type { SodConstraintResponse, SodConstraintPayload } from "@/services/api/settings";
import { segregationOfDuties as segregationOfDutiesBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { usePermissionCatalog } from "@/features/security-authorization/shared/usePermissionCatalog";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";

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

  const [initial, setInitial] = useState<SodConstraintResponse | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [name, setName] = useState("");
  const [codeA, setCodeA] = useState("");
  const [codeB, setCodeB] = useState("");
  const [permissionSearchA, setPermissionSearchA] = useState("");
  const [permissionSearchB, setPermissionSearchB] = useState("");
  const [severity, setSeverity] = useState<"WARN" | "BLOCK">("WARN");
  const [regulationRef, setRegulationRef] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const renderPermissionTable = (
    label: "Permission A" | "Permission B",
    selectedCode: string,
    onSelect: (code: string) => void,
    search: string,
    onSearchChange: (value: string) => void,
    otherCode: string,
  ) => {
    const normalizedSearch = search.trim().toLowerCase();
    const rows = permissionRows.filter((permission) =>
      !normalizedSearch
      || `${permission.id} ${permission.label} ${permission.groupName}`.toLowerCase().includes(normalizedSearch),
    );
    return (
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="mt-0.5 text-xs text-slate-500">Select one permission to compare.</p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search permission..."
              disabled={isSystem || catalogLoading}
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {catalogLoading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">Loading permissions...</div>
          ) : rows.length === 0 ? (
            <TableEmptyState title="No permissions found" description="Try a different search term." />
          ) : (
            <table className="w-full min-w-[360px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th className="w-10 border-b border-slate-200 px-3 py-2 text-left text-2xs font-bold uppercase tracking-wider text-slate-500">Select</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-2xs font-bold uppercase tracking-wider text-slate-500">Permission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((permission) => {
                  const selected = selectedCode === permission.id;
                  const unavailable = otherCode === permission.id;
                  return (
                    <tr key={permission.id} className={cn(selected && "bg-emerald-50", unavailable && "opacity-45")}>
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={selected}
                          onChange={() => onSelect(permission.id)}
                          disabled={isSystem || unavailable}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          disabled={isSystem || unavailable}
                          onClick={() => onSelect(permission.id)}
                          className="block w-full text-left disabled:cursor-not-allowed"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                            <span className="font-medium text-slate-800">{permission.label}</span>
                            <span className="font-mono text-[11px] text-slate-500">{permission.id}</span>
                            <span className="text-[11px] text-slate-400">{permission.groupName}</span>
                          </div>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

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
            <Button size="sm" variant="outline-emerald" onClick={() => void handleSave()} disabled={saving || isSystem} className="whitespace-nowrap">
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      {isSystem && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
          This is a system-defined constraint and cannot be modified.
        </div>
      )}

      <FormSection
        title="Constraint Identity"
        icon={<ShieldAlert className="h-4 w-4" />}
        description="Give this conflict rule a clear business name and reference."
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
        description="Choose the two permissions that must not coexist in the same Access Profile or user assignment."
        contentClassName="p-4 md:p-5 space-y-4"
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          Select a different permission on each side. The selected permission is disabled in the opposite table.
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {renderPermissionTable("Permission A", codeA, setCodeA, permissionSearchA, setPermissionSearchA, codeB)}
          {renderPermissionTable("Permission B", codeB, setCodeB, permissionSearchB, setPermissionSearchB, codeA)}
        </div>
        {codeA && codeB && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span className="font-semibold">Conflict:</span> {codeA} cannot coexist with {codeB}.
          </div>
        )}
      </FormSection>

      <FormSection
        title="Enforcement Settings"
        icon={<Shield className="h-4 w-4" />}
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
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 self-start">
            <Checkbox checked={active} onChange={setActive} disabled={isSystem} label="Active" />
          </div>
        </div>
      </FormSection>
    </div>
  );
};
