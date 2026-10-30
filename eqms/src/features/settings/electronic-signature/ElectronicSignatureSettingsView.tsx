import React, { useEffect, useMemo, useState } from "react";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import {
  MousePointerClick,
} from "lucide-react";
import { useNavigateWithLoading } from "@/hooks/useNavigateWithLoading";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { electronicSignatureSettings as electronicSignatureSettingsBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { FormSection } from "@/components/ui/form/FormSection";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast/Toast";
import { cn } from "@/components/ui/utils";
import { COMPONENT_PRESETS } from "@/config/ui-standards";
import {
  ElectronicSignatureMeaning,
  ElectronicSignatureSettings,
  electronicSignatureSettingsApi,
} from "@/services/api/electronicSignatureSettings";
import { usePermissions } from "@/hooks/usePermissions";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { SignatureDisplayStyles } from "./SignatureDisplayStyles";
import { SignatureMeaningsTable } from "./SignatureMeaningsTable";
import { IconCalendarTime } from "@tabler/icons-react";
import { displayDateTime } from "@/utils/format";

const defaultSettings: ElectronicSignatureSettings = {
  signatureTimestampFormat: "dd/MM/uuuu HH:mm",
  signatureTimezone: "Asia/Ho_Chi_Minh",
  meanings: [],
};

const ESIGN_TABS = [
  { id: "timestamp", label: "Signature Timestamp" },
  { id: "styles", label: "Signature Styles" },
  { id: "meanings", label: "Signature Meanings" },
];

const TIMESTAMP_FORMAT_OPTIONS = [{ value: "dd/MM/uuuu HH:mm", label: "17/07/2026 15:30 (dd/MM/yyyy HH:mm)" }];

export const ElectronicSignatureSettingsView: React.FC = () => {
  const { navigateTo } = useNavigateWithLoading();
  const { showToast } = useToast();
  const { requestSignature, signatureModal } = useSecurityESign();
  const { hasPermissionAlias } = usePermissions();
  const canManageConfiguration = hasPermissionAlias(
    "settings.configuration.manage",
  );
  const [settings, setSettings] =
    useState<ElectronicSignatureSettings>(defaultSettings);
  const [savedSettings, setSavedSettings] =
    useState<ElectronicSignatureSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTimestampWarning, setShowTimestampWarning] = useState(false);
  const [tab, setTab] = useState<"timestamp" | "styles" | "meanings">("timestamp");

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

  const updateMeaning = (
    code: string,
    patch: Partial<ElectronicSignatureMeaning>,
  ) => {
    const next = settings.meanings.map((m) =>
      m.code === code ? { ...m, ...patch } : m,
    );
    update("meanings", next);
  };

  const update = <K extends keyof ElectronicSignatureSettings>(
    key: K,
    value: ElectronicSignatureSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const timestampConfigurationChanged =
    settings.signatureTimestampFormat !==
      savedSettings.signatureTimestampFormat ||
    settings.signatureTimezone !== savedSettings.signatureTimezone;

  const save = async () => {
    const sig = await requestSignature(
      "Update Electronic Signature Settings",
      "Security Configuration Change",
    );
    if (!sig) return;
    setSaving(true);
    try {
      const saved = await electronicSignatureSettingsApi.saveSettings(
        settings,
        sig,
      );
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
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
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

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

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
              disabled={saving || !isDirty}
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
              This page controls how electronic signatures are displayed and
              what the signing modal asks from users. After you save, every
              workflow screen will use the same server-side configuration.
            </p>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex gap-2">
                <span className="shrink-0 font-semibold text-emerald-600">
                  1
                </span>
                <span>
                  Open the <strong>Signature Meanings</strong>{" "}
                  tab to rename the label shown for each system-defined
                  signing action.
                </span>
              </div>
              <div className="flex gap-2">
                <span className="shrink-0 font-semibold text-emerald-600">
                  2
                </span>
                <span>
                  Every signature always requires a password and a free-text
                  reason — this is not configurable per GMP/21 CFR Part 11.
                </span>
              </div>
              <div className="flex gap-2">
                <span className="shrink-0 font-semibold text-emerald-600">
                  3
                </span>
                <span>
                  Click <strong>Save Changes</strong>. The modal reloads the
                  latest settings automatically.
                </span>
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
                ["APPROVED", "Complete Approval"],
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TabNav tabs={ESIGN_TABS} activeTab={tab} onChange={(id) => setTab(id as "timestamp" | "styles" | "meanings")} ariaLabel="Electronic signature configuration" />
        <div className="space-y-4 p-4 md:p-5">
          {tab === "timestamp" && (
            <>
          <FormSection
            title="Signature Timestamp"
            icon={<IconCalendarTime className="h-4 w-4" />}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label
                  className={cn(COMPONENT_PRESETS.formLabel, "mb-1.5 block")}
                >
                  Timestamp Format
                </label>
                <Select
                  value={settings.signatureTimestampFormat}
                  onChange={(value) =>
                    update(
                      "signatureTimestampFormat",
                      value as ElectronicSignatureSettings["signatureTimestampFormat"],
                    )
                  }
                  options={TIMESTAMP_FORMAT_OPTIONS}
                />
              </div>
              <div>
                <label
                  className={cn(COMPONENT_PRESETS.formLabel, "mb-1.5 block")}
                >
                  Timezone
                </label>
<p className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-700">Asia/Ho_Chi_Minh (UTC+7), the zone of the site</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs sm:text-sm leading-5 text-amber-900">
              This configuration is effective only for electronic signatures and
              signature blocks created after the change is saved. Existing
              signatures, released DOCX/PDF files, and stored previews are not
              regenerated or overwritten.
            </div>
            {settings.timestampFormatEffectiveFrom && (
              <p className="mt-3 text-xs text-slate-500">
                Current configuration effective from:{" "}
                {displayDateTime(settings.timestampFormatEffectiveFrom)}
              </p>
            )}
          </FormSection>
            </>
          )}
          {tab === "styles" && <SignatureDisplayStyles />}
          {tab === "meanings" && (
            <SignatureMeaningsTable
              meanings={settings.meanings}
              canEdit={canManageConfiguration}
              onRename={(code, displayName) => updateMeaning(code, { displayName })}
              savedVersion={savedSettings.meanings.map((m) => `${m.code}:${m.displayName}`).join("|")}
            />
          )}
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
        title="Apply New Signature Timestamp Configuration?"
        description={
          <div className="space-y-3">
            <p>
              The new timestamp format and timezone will apply only to
              electronic signatures and signature blocks created after this
              configuration is saved.
            </p>
            <p className="font-medium text-amber-900">
              Previously signed records, released DOCX/PDF files, and existing
              stored previews will remain unchanged.
            </p>
            <p>
              This global security configuration change requires your electronic
              signature and will be recorded in the Audit Trail.
            </p>
          </div>
        }
        confirmText="Continue to Sign & Save"
        cancelText="Keep Editing"
      />
      {signatureModal}
    </div>
  );
};
