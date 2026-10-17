import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "@/features/training-activities/TrainingFields";
import { Switch } from "@/components/ui";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { trainingProperties } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { trainingError, trainingSettingsApi, type TrainingSettings } from "@/services/api/trainingActivities";

type NumberKey = Exclude<keyof TrainingSettings, "integrationEnabled" | "version" | "updatedAt">;
const FIELDS: { key: NumberKey; label: string; hint: string; min: number; max: number }[] = [
  { key: "passPercent", label: "Pass mark (%)", hint: "A trainee passes a test with at least this percentage. The system computes the result.", min: 1, max: 100 },
  { key: "documentTrainingDaysDefault", label: "Days to train on a new document", hint: "Default Training Period (days) proposed for a document that requires training.", min: 1, max: 365 },
  { key: "resultsDueWorkingDays", label: "Working days to send results to QA", hint: "After the last session the results are due to QA within this time.", min: 1, max: 60 },
  { key: "annualRequirementDueMonth", label: "Annual requirement due month", hint: "Month (1 to 12) by which the annual training requirement is due.", min: 1, max: 12 },
  { key: "annualRequirementDueDay", label: "Annual requirement due day", hint: "Day of that month.", min: 1, max: 31 },
  { key: "absenceRetrainMonths", label: "Months of absence before retraining", hint: "After an absence longer than this a person is retrained.", min: 1, max: 60 },
  { key: "retentionYearsAfterLeaving", label: "Years to keep records after leaving", hint: "Training records are kept at least 10 years after the employee leaves.", min: 10, max: 100 },
];

/** Settings of Training Management. A change needs the version that was read and a reason, is checked by the server and is recorded in the Audit Trail. */
export const TrainingPropertiesView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("training.settings.manage");
  const [loaded, setLoaded] = useState<TrainingSettings>();
  const [form, setForm] = useState<Record<string, string>>({});
  const [integration, setIntegration] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const apply = (s: TrainingSettings) => {
    setLoaded(s);
    setIntegration(s.integrationEnabled);
    setForm(Object.fromEntries(FIELDS.map((f) => [f.key, String(s[f.key])])));
    setReason("");
  };
  useEffect(() => {
    trainingSettingsApi.get().then(apply).catch((e) => setError(trainingError(e)));
  }, []);

  const save = async () => {
    if (!loaded) return;
    setBusy(true);
    try {
      const values = Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])]));
      apply(await trainingSettingsApi.update({ ...values, version: loaded.version, reason: reason.trim(), integrationEnabled: integration }));
      showToast({ type: "success", title: "Training settings saved", message: "" });
    } catch (e) {
      showToast({ type: "error", title: "The settings were not saved", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };

  const invalid = FIELDS.some((f) => {
    const v = Number(form[f.key]);
    return !Number.isInteger(v) || v < f.min || v > f.max;
  });
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title="Training Properties" breadcrumbItems={trainingProperties(navigate)} />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!loaded ? (
        !error && <SectionLoading text="Loading settings…" />
      ) : (
        <FormSection title="Settings">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {FIELDS.map((f) => (
              <FormField key={f.key} label={f.label} hint={f.hint}>
                <Input type="number" min={f.min} max={f.max} disabled={!canEdit} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              </FormField>
            ))}
            <FormField label="Link with Document Control" hint="When on, a document that requires training gets a Training Number and is completed through Training Management. When off, training dates are typed in Document Control.">
              <Switch checked={integration} disabled={!canEdit} onChange={setIntegration} />
            </FormField>
            {canEdit && (
              <div className="md:col-span-2">
                <FormField label="Reason for the change" required>
                  <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                </FormField>
              </div>
            )}
          </div>
          {canEdit && (
            <div className="mt-4 flex justify-end">
              <Button variant="default" loading={busy} disabled={invalid || !reason.trim()} onClick={() => void save()}>
                Save settings
              </Button>
            </div>
          )}
        </FormSection>
      )}
    </div>
  );
};
