import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Shield, Filter, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormSection } from "@/components/ui/form/FormSection";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { cn } from "@/components/ui/utils";
import { settingsApi } from "@/services/api";
import type { ObjectAccessRuleResponse, ObjectAccessRulePayload, ObjectAccessRuleOptionsResponse } from "@/services/api/settings";
import { objectAccessRules as objectAccessRulesBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";

const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const inputClass =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400";
const textareaClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 resize-none";

const VIEW_PERM = "security.object_rules.view";
const MANAGE_PERM = "security.object_rules.manage";

export const ObjectAccessRuleFormView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias(MANAGE_PERM);
  const { requestSignature, signatureModal } = useSecurityESign();

  const [initial, setInitial] = useState<ObjectAccessRuleResponse | null>(null);
  const [options, setOptions] = useState<ObjectAccessRuleOptionsResponse | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accessProfileId, setAccessProfileId] = useState("");
  const [resourceType, setResourceType] = useState<string>("");
  const [resourceName, setResourceName] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [effect, setEffect] = useState<"ALLOW" | "DENY">("ALLOW");
  const [priority, setPriority] = useState(0);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    settingsApi
      .getObjectAccessRuleOptions()
      .then((o) => {
        if (cancelled) return;
        setOptions(o);
        setResourceType((prev) => prev || o.resourceTypes[0] || "");
      })
      .catch(() => {
        if (!cancelled) showToast({ type: "error", message: "Failed to load rule options" });
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    settingsApi
      .getObjectAccessRule(id)
      .then((r) => {
        if (cancelled) return;
        setInitial(r);
        setName(r.name);
        setDescription(r.description ?? "");
        setAccessProfileId(r.accessProfileId ?? "");
        setResourceType(r.resourceType);
        setResourceName(r.resourceName ?? "");
        setActions(r.actions ?? []);
        setEffect(r.effect);
        setPriority(r.priority);
        setActive(r.active);
      })
      .catch(() => {
        if (!cancelled) showToast({ type: "error", message: "Failed to load object access rule" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, showToast]);

  const toggleAction = (a: string) =>
    setActions((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const handleBack = () => navigateBack(navigate, location.state, ROUTES.SECURITY.OBJECT_RULES);

  const nameMissing = !name.trim();
  const actionsMissing = actions.length === 0;
  const formInvalid = nameMissing || actionsMissing;
  const invalidReason = nameMissing
    ? "Name is required"
    : actionsMissing
      ? "Select at least one action"
      : undefined;

  const handleSave = async () => {
    if (formInvalid) return;
    const sig = await requestSignature(isEdit ? "Update Object Access Rule" : "Create Object Access Rule", "Security Configuration Change");
    if (!sig) return;
    setSaving(true);
    const payload: ObjectAccessRulePayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      accessProfileId: accessProfileId || null,
      resourceType,
      resourceName: resourceName.trim() || undefined,
      actions,
      effect,
      priority,
      active,
    };
    try {
      if (initial) {
        await settingsApi.updateObjectAccessRule(initial.id, payload, sig);
        showToast({ type: "success", message: "Rule updated" });
      } else {
        await settingsApi.createObjectAccessRule(payload, sig);
        showToast({ type: "success", message: "Rule created" });
      }
      handleBack();
    } catch (e: any) {
      showToast({ type: "error", message: e?.response?.data?.message ?? "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <FullPageLoading text="Loading object access rule..." />;
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm">You do not have permission to manage Object Access Rules.</p>
      </div>
    );
  }

  const title = isEdit ? "Edit Object Access Rule" : "New Object Access Rule";

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {signatureModal}
      <PageHeader
        title={title}
        breadcrumbItems={objectAccessRulesBreadcrumb(navigate, title)}
        actions={
          <>
            <Button variant="outline-emerald" size="sm" onClick={handleBack} className="whitespace-nowrap">
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => void handleSave()}
              disabled={saving || formInvalid}
              title={invalidReason}
              className="whitespace-nowrap"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      <FormSection
        title="Rule Identity"
        icon={<Filter className="h-4 w-4" />}
        description={
          isEdit
            ? "Name and describe this object access rule."
            : "Give the rule a clear, business-friendly name."
        }
        contentClassName="p-4 md:p-5"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <label className={labelClass}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              className={cn(inputClass, nameMissing && "border-red-300 focus:ring-red-500 focus:border-red-500")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Restrict SOPs to QA Department"
              aria-invalid={nameMissing}
              autoFocus
            />
            {nameMissing && <p className="text-xs text-red-500 mt-1.5">Name is required.</p>}
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              className={textareaClass}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the intent of this access rule"
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Scope & Actions"
        icon={<Shield className="h-4 w-4" />}
        description="Choose the subject profile, protected resource scope and actions this rule evaluates."
        contentClassName="p-4 md:p-5 space-y-4"
      >
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          Leave the subject profile or resource name as All only when the rule must apply system-wide.
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Select
            label="Subject Access Profile"
            value={accessProfileId}
            onChange={(v) => setAccessProfileId(String(v))}
            options={[
              { label: "All Access Profiles (system-wide)", value: "" },
              ...(options?.accessProfiles ?? []).map((profile) => ({
                label: `${profile.name} (${profile.code})`,
                value: profile.id,
              })),
            ]}
            enableSearch
            searchPlaceholder="Search access profiles..."
            isLoading={!options}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:col-span-2">
            <Select
              label="Resource Type"
              value={resourceType}
              onChange={(v) => {
                setResourceType(String(v));
                setResourceName("");
              }}
              options={(options?.resourceTypes ?? []).map((t) => ({ label: t.replace(/_/g, " "), value: t }))}
              isLoading={!options}
            />
            <Select
              label="Resource Name"
              value={resourceName}
              onChange={(v) => setResourceName(String(v))}
              options={[
                { label: "All (no restriction)", value: "" },
                // Keep an unknown legacy value selectable so editing an old rule doesn't wipe it.
                ...(resourceName && !(options?.resourceValues?.[resourceType] ?? []).includes(resourceName)
                  ? [{ label: `${resourceName} (unknown)`, value: resourceName }]
                  : []),
                ...(options?.resourceValues?.[resourceType] ?? []).map((v) => ({ label: v, value: v })),
              ]}
              enableSearch
              searchPlaceholder="Search..."
              isLoading={!options}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className={labelClass}>
            Actions <span className="text-red-500">*</span>
          </label>
          <p className="mb-3 text-xs text-slate-500">Select every business action this rule applies to.</p>
          <div className="flex flex-wrap gap-2">
            {(options?.actions ?? []).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggleAction(a)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                  actions.includes(a)
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-emerald-300",
                )}
              >
                {a}
              </button>
            ))}
          </div>
          {actionsMissing && <p className="text-xs text-red-500 mt-1.5">Select at least one action.</p>}
        </div>
      </FormSection>

      <FormSection
        title="Evaluation Settings"
        icon={<SlidersHorizontal className="h-4 w-4" />}
        description="Set the decision effect, precedence and whether the rule is active."
        contentClassName="p-4 md:p-5"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Effect</label>
              <div className="flex gap-2">
                {(["ALLOW", "DENY"] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEffect(e)}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors",
                      effect === e
                        ? e === "ALLOW"
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "bg-red-500 border-red-500 text-white"
                        : "border-slate-200 text-slate-600 hover:border-slate-300",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <input
                type="number"
                min={0}
                max={1000}
                step={1}
                className={inputClass}
                value={priority}
                onChange={(e) => setPriority(Math.max(0, Number(e.target.value) || 0))}
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Higher priority wins when multiple rules match the same resource (0–1000).
              </p>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Checkbox checked={active} onChange={setActive} label="Active" />
          </div>
        </div>
      </FormSection>
    </div>
  );
};
