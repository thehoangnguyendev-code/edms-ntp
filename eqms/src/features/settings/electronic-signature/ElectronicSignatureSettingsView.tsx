import React, { useEffect, useMemo, useState } from "react";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { ClipboardList, Clock3, Eye, KeyRound, MousePointerClick, PenTool, ShieldCheck } from "lucide-react";
import { useNavigateWithLoading } from "@/hooks/useNavigateWithLoading";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { electronicSignatureSettings as electronicSignatureSettingsBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { FormSection } from "@/components/ui/form/FormSection";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast/Toast";
import { cn } from "@/components/ui/utils";
import { COMPONENT_PRESETS } from "@/config/ui-standards";
import {
  ElectronicSignatureSettings,
  electronicSignatureSettingsApi,
} from "@/services/api/electronicSignatureSettings";
import { usePermissions } from "@/hooks/usePermissions";

const defaultSettings: ElectronicSignatureSettings = {
  requirePasswordBeforeSigning: true,
  requireReason: true,
  commentRule: "OPTIONAL",
  allowedAuthMethod: "PASSWORD",
  showAuditTrailSummary: true,
  signatureTimestampFormat: "dd-MMM-uuuu HH:mm:ss",
  signatureTimezone: "Asia/Ho_Chi_Minh",
  meanings: [],
};

const COMMENT_RULE_OPTIONS = [
  { value: "OPTIONAL", label: "Optional" },
  { value: "REQUIRED", label: "Required" },
  { value: "HIDDEN", label: "Hidden" },
];

const AUTH_METHOD_OPTIONS = [
  { value: "PASSWORD", label: "Password" },
];

const TIMESTAMP_FORMAT_OPTIONS = [
  { value: "dd-MMM-uuuu HH:mm:ss", label: "17-Jul-2026 15:30:45" },
  { value: "dd/MM/uuuu HH:mm:ss", label: "17/07/2026 15:30:45" },
  { value: "uuuu-MM-dd HH:mm:ss", label: "2026-07-17 15:30:45" },
  { value: "MM/dd/uuuu hh:mm:ss a", label: "07/17/2026 03:30:45 PM" },
];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Ho_Chi_Minh", label: "Vietnam (UTC+7)" },
  { value: "UTC", label: "UTC" },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { value: "Asia/Tokyo", label: "Japan (UTC+9)" },
  { value: "Europe/London", label: "United Kingdom" },
];

const AllowedReasonsEditor: React.FC<{ reasons: string[]; onChange: (reasons: string[]) => void }> = ({ reasons, onChange }) => {
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed || reasons.includes(trimmed)) return;
    onChange([...reasons, trimmed]);
    setDraft("");
  };

  const remove = (idx: number) => onChange(reasons.filter((_, i) => i !== idx));

  return (
    <div className="space-y-1.5">
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {reasons.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-2xs font-medium text-emerald-700">
              {r}
              <button type="button" onClick={() => remove(i)} className="ml-0.5 text-emerald-400 hover:text-red-500 leading-none">&times;</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          className="flex-1 min-w-0 h-9 rounded-lg border border-slate-200 px-2.5 text-xs sm:text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="Add reason..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button type="button" size="sm" variant="default" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
};

export const ElectronicSignatureSettingsView: React.FC = () => {
  const { navigateTo } = useNavigateWithLoading();
  const { showToast } = useToast();
  const { requestSignature, signatureModal } = useSecurityESign();
  const { hasPermissionAlias } = usePermissions();
  const canManageConfiguration = hasPermissionAlias('settings.configuration.manage') || hasPermissionAlias('settings.configuration.edit');
  const [settings, setSettings] =
    useState<ElectronicSignatureSettings>(defaultSettings);
  const [savedSettings, setSavedSettings] =
    useState<ElectronicSignatureSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTimestampWarning, setShowTimestampWarning] = useState(false);
  const [timestampPreview, setTimestampPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  const breadcrumbItems = useMemo(
    () => electronicSignatureSettingsBreadcrumbs(navigateTo),
    [navigateTo],
  );

  useEffect(() => {
    let active = true;
    electronicSignatureSettingsApi
      .getSettings()
      .then((data) => {
        if (active) {
          const loaded = { ...defaultSettings, ...data };
          setSettings(loaded);
          setSavedSettings(loaded);
        }
      })
      .catch((error) => {
        // 429 already surfaces its own clear notice via RateLimitNoticeListener.
        if (active && error?.response?.status !== 429)
          showToast({
            message: "Unable to load E-Sign Config from server.",
            type: "error",
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  const update = <K extends keyof ElectronicSignatureSettings>(
    key: K,
    value: ElectronicSignatureSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const timestampConfigurationChanged =
    settings.signatureTimestampFormat !== savedSettings.signatureTimestampFormat ||
    settings.signatureTimezone !== savedSettings.signatureTimezone;

  useEffect(() => {
    if (!timestampConfigurationChanged) {
      setTimestampPreview(settings.previewBlock || null);
      setPreviewLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      electronicSignatureSettingsApi
        .previewTimestamp({
          signatureTimestampFormat: settings.signatureTimestampFormat,
          signatureTimezone: settings.signatureTimezone,
        })
        .then((response) => {
          if (active) setTimestampPreview(response.previewBlock);
        })
        .catch(() => {
          if (active) setTimestampPreview(null);
        })
        .finally(() => {
          if (active) setPreviewLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    settings.previewBlock,
    settings.signatureTimestampFormat,
    settings.signatureTimezone,
    timestampConfigurationChanged,
  ]);

  const save = async () => {
    const sig = await requestSignature("Update Electronic Signature Settings", "Security Configuration Change");
    if (!sig) return;
    setSaving(true);
    try {
      const saved = await electronicSignatureSettingsApi.saveSettings(settings, sig);
      const normalized = { ...defaultSettings, ...saved };
      setSettings(normalized);
      setSavedSettings(normalized);
      showToast({
        title: "Settings Saved",
        message: "Electronic signature settings saved successfully.",
        type: "success",
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : null) ||
        "Failed to save settings. Please try again.";
      showToast({
        title: "Save Failed",
        message: msg,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const beginSave = () => {
    if (timestampConfigurationChanged) {
      setShowTimestampWarning(true);
      return;
    }
    void save();
  };

  if (loading) {
    return <FullPageLoading text="Loading E-Sign Config..." />;
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title="E-Sign Config"
        breadcrumbItems={breadcrumbItems}
        actions={
          canManageConfiguration ? (
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={beginSave}
              disabled={saving}
              className="gap-2 whitespace-nowrap"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          ) : undefined
        }
      />

      <FormSection
        title="How to use"
        icon={<MousePointerClick className="h-4 w-4" />}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              This page controls how electronic signatures are displayed and what
              the signing modal asks from users. After you save, every workflow
              screen will use the same server-side configuration.
            </p>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex gap-2">
                <span className="shrink-0 font-semibold text-emerald-600">1</span>
                <span>Edit the <strong>Signature Meaning Configuration</strong> table.</span>
              </div>
              <div className="flex gap-2">
                <span className="shrink-0 font-semibold text-emerald-600">2</span>
                <span>Set the workflow step code, display name, allowed reasons, and comment rule.</span>
              </div>
              <div className="flex gap-2">
                <span className="shrink-0 font-semibold text-emerald-600">3</span>
                <span>Use <strong>Re-authentication Rule</strong> to define password, reason, and comment behavior.</span>
              </div>
              <div className="flex gap-2">
                <span className="shrink-0 font-semibold text-emerald-600">4</span>
                <span>Click <strong>Save Changes</strong>. The modal reloads the latest settings automatically.</span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-3">
              Common workflow meanings
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["PREPARED", "Complete Editing"],
                ["SUBMITTED_FOR_REVIEW", "Submit for Review"],
                ["REVIEWED", "Complete Review"],
                ["APPROVED", "Complete Approve"],
                ["TRAINING_CONFIRMED", "Complete Training"],
                ["PUBLISHED", "Publish"],
                ["OBSOLETED", "Obsolete"],
              ].map(([code, label]) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                >
                  <span className="font-semibold text-emerald-700">{code}</span>
                  <span className="text-slate-400">•</span>
                  <span>{label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </FormSection>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[70%_30%]">
        <div className="space-y-4">
                    <FormSection
            title="Signature Timestamp"
            icon={<Clock3 className="h-4 w-4" />}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className={cn(COMPONENT_PRESETS.formLabel, "mb-1.5 block")}>
                  Timestamp Format
                </label>
                <Select
                  value={settings.signatureTimestampFormat}
                  onChange={(value) => update(
                    "signatureTimestampFormat",
                    value as ElectronicSignatureSettings["signatureTimestampFormat"],
                  )}
                  options={TIMESTAMP_FORMAT_OPTIONS}
                />
              </div>
              <div>
                <label className={cn(COMPONENT_PRESETS.formLabel, "mb-1.5 block")}>
                  Timezone
                </label>
                <Select
                  value={settings.signatureTimezone}
                  onChange={(value) => update("signatureTimezone", value)}
                  options={TIMEZONE_OPTIONS}
                />
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs sm:text-sm leading-5 text-amber-900">
              This configuration is effective only for electronic signatures and signature blocks created after the change is saved. Existing signatures, released DOCX/PDF files, and stored previews are not regenerated or overwritten.
            </div>
            {settings.timestampFormatEffectiveFrom && (
              <p className="mt-3 text-xs text-slate-500">
                Current configuration effective from: {new Date(settings.timestampFormatEffectiveFrom).toLocaleString()}
              </p>
            )}
          </FormSection>
          <FormSection
            title="Signature Meaning Configuration"
            icon={<ClipboardList className="h-4 w-4" />}
          >
            <p className="mb-3 text-xs sm:text-sm text-slate-600">
              Meaning codes define the workflow purpose for each signature step.
              These meanings are reused by any module that calls the electronic
              signature service.
            </p>
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Example values for each field
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {[
                  {
                    field: "Code",
                    example: "PREPARED",
                    note: "Use an all-caps technical code. This is what the workflow and backend read.",
                  },
                  {
                    field: "Display Name",
                    example: "Prepared",
                    note: "This is the readable label shown in the signing modal.",
                  },
                  {
                    field: "Description",
                    example: "User confirms the document has been prepared and is ready for review.",
                    note: "Optional helper text for admin and audit clarity.",
                  },
                  {
                    field: "Allowed Reasons",
                    example: "Document Preparation, Draft Finalization",
                    note: "Only fill this when the step should present predefined reasons in the modal.",
                  },
                  {
                    field: "Require Reason",
                    example: "Checked",
                    note: "Turn on when the signer must select or type a reason before confirming.",
                  },
                  {
                    field: "Comment Rule",
                    example: "OPTIONAL",
                    note: "Use HIDDEN, OPTIONAL, or REQUIRED depending on whether comment is shown.",
                  },
                  {
                    field: "Active",
                    example: "Checked",
                    note: "Disable unused meanings so they no longer appear in the modal.",
                  },
                ].map((item) => (
                  <div
                    key={item.field}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">
                        {item.field}
                      </div>
                      <Badge color="emerald" size="xs" variant="outline">
                        Example
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-600">
                      <span className="font-semibold text-slate-800">Value:</span>{" "}
                      <span className="font-medium text-emerald-700">{item.example}</span>
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      {item.note}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {settings.meanings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No signature meanings configured.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div
                  ref={scrollerRef as React.RefObject<HTMLDivElement>}
                  className={cn(
                    "overflow-x-auto",
                    isDragging ? "cursor-grabbing select-none" : "cursor-grab",
                  )}
                  {...dragEvents}
                >
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        {["Code", "Display Name", "Description", "Allowed Reasons", "Require Reason", "Comment Rule", "Active"].map((h, i) => (
                          <th
                            key={h}
                            className={cn(
                              "bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap",
                              i >= 4 ? "text-center" : "text-left",
                            )}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {settings.meanings.map((meaning, index) => {
                        const updateMeaning = (patch: Partial<typeof meaning>) => {
                          const next = [...settings.meanings];
                          next[index] = { ...meaning, ...patch };
                          update("meanings", next);
                        };
                        return (
                          <tr key={meaning.code} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap font-medium text-slate-900 align-middle">
                              {meaning.code}
                            </td>
                            <td className="py-3 px-4 align-middle">
                              <input
                                className="w-full min-w-[100px] h-9 rounded-lg border border-slate-200 px-2.5 text-xs sm:text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                value={meaning.displayName}
                                onChange={(e) => updateMeaning({ displayName: e.target.value })}
                              />
                            </td>
                            <td className="py-3 px-4 align-middle">
                              <input
                                className="w-full min-w-[120px] h-9 rounded-lg border border-slate-200 px-2.5 text-xs sm:text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                value={meaning.description || ""}
                                onChange={(e) => updateMeaning({ description: e.target.value })}
                              />
                            </td>
                            <td className="py-3 px-4 min-w-[220px] align-top">
                              <AllowedReasonsEditor
                                reasons={meaning.allowedReasons || []}
                                onChange={(reasons) => updateMeaning({ allowedReasons: reasons })}
                              />
                            </td>
                            <td className="py-3 px-4 align-middle">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={Boolean(meaning.requiresReason)}
                                  onChange={(checked) => updateMeaning({ requiresReason: checked })}
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4 align-middle">
                              <Select
                                value={meaning.commentRule || "OPTIONAL"}
                                onChange={(val) => updateMeaning({ commentRule: val as typeof meaning.commentRule })}
                                options={COMMENT_RULE_OPTIONS}
                              />
                            </td>
                            <td className="py-3 px-4 align-middle">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={Boolean(meaning.active)}
                                  onChange={(checked) => updateMeaning({ active: checked })}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </FormSection>

          <FormSection
            title="Re-authentication Rule"
            icon={<KeyRound className="h-4 w-4" />}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <Checkbox
                  checked={settings.requirePasswordBeforeSigning}
                  onChange={(checked) =>
                    update("requirePasswordBeforeSigning", checked)
                  }
                  label="Require password before signing"
                />
                <Checkbox
                  checked={settings.requireReason}
                  onChange={(checked) => update("requireReason", checked)}
                  label="Require reason"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <label
                    className={cn(COMPONENT_PRESETS.formLabel, "mb-1.5 block")}
                  >
                    Comment Rule
                  </label>
                  <Select
                    value={settings.commentRule}
                    onChange={(val) =>
                      update(
                        "commentRule",
                        val as ElectronicSignatureSettings["commentRule"],
                      )
                    }
                    options={COMMENT_RULE_OPTIONS}
                  />
                </div>
                <div>
                  <label
                    className={cn(COMPONENT_PRESETS.formLabel, "mb-1.5 block")}
                  >
                    Allowed Auth Method
                  </label>
                  <Select
                    value={settings.allowedAuthMethod}
                    onChange={(val) =>
                      update(
                        "allowedAuthMethod",
                        val as ElectronicSignatureSettings["allowedAuthMethod"],
                      )
                    }
                    options={AUTH_METHOD_OPTIONS}
                  />
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Audit Trail Display Rule"
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <div className="space-y-3">
              <Checkbox
                checked={settings.showAuditTrailSummary}
                onChange={(checked) => update("showAuditTrailSummary", checked)}
                label="Show audit trail summary beside signature display records"
              />
              <p className="text-sm text-slate-600">
                Technical fields such as IP address, user agent, auth method,
                and checksum are stored in audit trail and can remain hidden
                from the cover display.
              </p>
            </div>
          </FormSection>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <FormSection
            title="Signature Block Format"
            icon={<PenTool className="h-4 w-4 -rotate-[90deg]" />}
          >
            <p className="mb-3 text-xs text-slate-500">
              {timestampConfigurationChanged
                ? "Previewing the unsaved timestamp configuration. It will not change any record until you complete Sign & Save."
                : "This is the active electronic signature display format used in new DOCX and PDF outputs."}
            </p>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-800 font-mono">
                {(() => {
                  return timestampPreview || settings.previewBlock || "Nguyen Van A\nElectronically Signed\n29-Jul-2026 13:22:09 (UTC+7)\nMeaning: Approved\nReason: Document Approval\nSignature ID: SIG-2026-8F3A9B";
                })()}
              </pre>
            </div>
            {timestampConfigurationChanged && (
              <p className="mt-2 text-xs font-medium text-amber-700">
                {previewLoading ? "Updating preview..." : "Unsaved preview"}
              </p>
            )}
            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 space-y-1">
              <p className="font-semibold">21 CFR Part 11 & EU-GMP Annex 11 Compliance</p>
              <p>
                Signature ID (Unique Electronic Signature Reference) is permanently embedded in all signature blocks and Audit Trail logs for full GxP traceability.
              </p>
            </div>
          </FormSection>
        </div>
      </div>
      <AlertModal
        isOpen={showTimestampWarning}
        onClose={() => setShowTimestampWarning(false)}
        onConfirm={() => {
          setShowTimestampWarning(false);
          void save();
        }}
        type="warning"
        title="Apply new signature timestamp configuration?"
        description={
          <div className="space-y-3">
            <p>
              The new timestamp format and timezone will apply only to electronic signatures and signature blocks created after this configuration is saved.
            </p>
            <p className="font-medium text-amber-900">
              Previously signed records, released DOCX/PDF files, and existing stored previews will remain unchanged.
            </p>
            <p>This global security configuration change requires your electronic signature and will be recorded in the Audit Trail.</p>
          </div>
        }
        confirmText="Continue to Sign & Save"
        cancelText="Keep Editing"
      />
      {signatureModal}
    </div>
  );
};
