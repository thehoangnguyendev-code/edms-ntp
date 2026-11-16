import React, { useEffect, useMemo, useState } from "react";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { MousePointerClick } from "lucide-react";
import { useNavigateWithLoading } from "@/hooks/useNavigateWithLoading";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { electronicSignatureSettings as electronicSignatureSettingsBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { FormSection } from "@/components/ui/form/FormSection";
import { Button } from "@/components/ui/button/Button";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import {
  ElectronicSignatureMeaning,
  ElectronicSignatureSettings,
  electronicSignatureSettingsApi,
} from "@/services/api/electronicSignatureSettings";
import { usePermissions } from "@/hooks/usePermissions";
import { SignatureMeaningsTable } from "./SignatureMeaningsTable";

const defaultSettings: ElectronicSignatureSettings = {
  signatureTimestampFormat: "dd/MM/uuuu HH:mm",
  signatureTimezone: "Asia/Ho_Chi_Minh",
  meanings: [],
};

/**
 * E-Sign Config: the list of actions that need an electronic signature. The action and its code are fixed by the
 * application; the only thing an administrator can configure is the meaning shown to the signer. The timestamp
 * format and the time zone are fixed (one format, the zone of the site) and are not part of this screen.
 */
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
    setSettings((prev) => ({
      ...prev,
      meanings: prev.meanings.map((m) => (m.code === code ? { ...m, ...patch } : m)),
    }));
  };

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
              onClick={() => void save()}
              disabled={saving || !isDirty}
              className="gap-2 whitespace-nowrap"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          ) : undefined
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 md:p-5">
          <SignatureMeaningsTable
            meanings={settings.meanings}
            canEdit={canManageConfiguration}
            onRename={(code, displayName) => updateMeaning(code, { displayName })}
            savedVersion={savedSettings.meanings.map((m) => `${m.code}:${m.displayName}`).join("|")}
          />
        </div>
      </div>
      {signatureModal}
    </div>
  );
};
