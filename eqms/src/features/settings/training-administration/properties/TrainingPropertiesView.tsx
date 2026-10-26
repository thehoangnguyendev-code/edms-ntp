import React from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Archive, BellRing, CalendarClock, GraduationCap, Link2, NotebookPen, Send, Timer } from "lucide-react";
import { IconPlus } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form/FormSection";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { Switch } from "@/components/ui/switch/Switch";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Textarea } from "@/features/training-activities/shared/TrainingFields";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { trainingProperties } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { trainingError, trainingSettingsApi, type TrainingSettings } from "@/services/api/trainingActivities";
import { TrainingFormTemplates } from "./TrainingFormTemplates";

/** Whole-number input that clamps to [min, max] and falls back when the field is emptied. */
const NumberField: React.FC<{
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  fallback: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}> = ({ label, hint, value, min, max, fallback, disabled, onChange }) => (
  <div className="min-w-0">
    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">{label}</label>
    <input
      type="number"
      min={min}
      max={max}
      disabled={disabled}
      value={value}
      onChange={(e) => {
        const parsed = parseInt(e.target.value, 10);
        onChange(Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback);
      }}
      className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50"
    />
    {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
  </div>
);

/**
 * The settings are one record saved together, but they govern different things, so each tab holds one subject and says in a sentence what it governs and where it is used.
 * "Save Changes" saves the changes of every tab.
 */
const SETTING_TABS = [
  { id: "assessment", label: "Assessment", about: "How a test is marked, and how soon the results go to QA. It is used when the trainer records the result of a training and sends it to QA." },
  { id: "documents", label: "Document Training", about: "How training on a new or revised document is organised. It is used when a document that requires training is created in Document Control." },
  { id: "annual", label: "Annual & Retraining", about: "When the annual requirement is due and when a person who was away is retrained. It is used by the training requirements and by the training reviews." },
  { id: "reminders", label: "Review Reminders", about: "When the person who must close a training review, and the person who opened it, are reminded. A reminder is sent once a week." },
  { id: "retention", label: "Records Retention", about: "How long training records are kept. It is used when the records of a person who left are archived." },
] as const;
const FORMS_TAB = {
  id: "forms",
  label: "Assessment Forms",
  about: "The Word source of a form such as APD.0009. The person who prepares a test starts from the enabled template and edits it in the browser. A template is enabled with an electronic signature, and enabling one disables the other of the same document number. The file never changes after it is uploaded.",
} as const;

/** Settings of Training Management. A change needs the version that was read and a reason, is checked by the server and is recorded in the Audit Trail. */
export const TrainingPropertiesView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.settings.manage");
  const canAdminister = hasPermission("training.admin.manage");

  const [params, setParams] = useSearchParams();
  const tabs: TabItem[] = [
    ...SETTING_TABS.map(({ id, label }) => ({ id, label })),
    ...(canAdminister ? [{ id: FORMS_TAB.id, label: FORMS_TAB.label }] : []),
  ];
  const requested = params.get("tab");
  const tab = tabs.some((x) => x.id === requested) ? (requested as string) : SETTING_TABS[0].id;
  const changeTab = (id: string) => setParams(id === SETTING_TABS[0].id ? {} : { tab: id }, { replace: true });
  const settingTab = SETTING_TABS.find((x) => x.id === tab);

  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [settings, setSettings] = React.useState<TrainingSettings | null>(null);
  const [original, setOriginal] = React.useState<TrainingSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const load = React.useCallback(() => {
    setLoading(true);
    setError(false);
    trainingSettingsApi
      .get()
      .then((data) => {
        setSettings(data);
        setOriginal(JSON.parse(JSON.stringify(data)));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(original);
  // A change made by someone else refreshes the values, but never over what the person is typing.
  const unsaved = React.useRef(false);
  unsaved.current = isDirty;
  useEntityChanged(["TRAINING"], () => {
    if (unsaved.current) return;
    trainingSettingsApi.get().then((data) => { setSettings(data); setOriginal(JSON.parse(JSON.stringify(data))); }).catch(() => undefined);
  });

  const patch = (next: Partial<TrainingSettings>) =>
    setSettings((prev) => (prev ? { ...prev, ...next } : prev));

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await trainingSettingsApi.update({
        passPercent: settings.passPercent,
        documentTrainingDaysDefault: settings.documentTrainingDaysDefault,
        annualRequirementDueMonth: settings.annualRequirementDueMonth,
        annualRequirementDueDay: settings.annualRequirementDueDay,
        absenceRetrainMonths: settings.absenceRetrainMonths,
        retentionYearsAfterLeaving: settings.retentionYearsAfterLeaving,
        reviewReadyReminderDays: settings.reviewReadyReminderDays,
        reviewOpenReminderDays: settings.reviewOpenReminderDays,
        resultsDueDays: settings.resultsDueDays,
        integrationEnabled: settings.integrationEnabled,
        version: settings.version,
        reason: reason.trim(),
      });
      setSettings(saved);
      setOriginal(JSON.parse(JSON.stringify(saved)));
      setReason("");
      setShowSaveModal(false);
      showToast({ type: "success", title: "Changes saved", message: "Training properties have been updated." });
    } catch (saveError) {
      setShowSaveModal(false);
      showToast({ type: "error", title: "Save failed", message: trainingError(saveError) });
    } finally {
      setSaving(false);
    }
  };

  const panels: Record<string, React.ReactNode> = settings ? {
    assessment: (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <FormSection title="Pass Mark" icon={<GraduationCap className="h-4 w-4" />} className="h-full">
          <NumberField
            label="Pass mark (%)"
            hint="A trainee passes a test with at least this percentage. The system computes the result."
            value={settings.passPercent}
            min={1}
            max={100}
            fallback={1}
            disabled={!canManage}
            onChange={(v) => patch({ passPercent: v })}
          />
        </FormSection>
        <FormSection title="Results to QA" icon={<NotebookPen className="h-4 w-4" />} className="h-full">
          <NumberField
            label="Days to send the results to QA"
            hint="Counted in calendar days from the day the training was held (SOP.0003 5.3.7). The organizer is reminded on the last day, then every week while the results are late."
            value={settings.resultsDueDays}
            min={1}
            max={60}
            fallback={7}
            disabled={!canManage}
            onChange={(v) => patch({ resultsDueDays: v })}
          />
        </FormSection>
      </div>
    ),
    documents: (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <FormSection title="Training Period" icon={<Timer className="h-4 w-4" />} className="h-full">
          <NumberField
            label="Days to train on a new document"
            hint="Default Training Period (days) proposed for a document that requires training."
            value={settings.documentTrainingDaysDefault}
            min={1}
            max={365}
            fallback={1}
            disabled={!canManage}
            onChange={(v) => patch({ documentTrainingDaysDefault: v })}
          />
        </FormSection>
        <FormSection title="Document Control Link" icon={<Link2 className="h-4 w-4" />} className="h-full">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Link with Document Control</p>
              <p className="mt-1 text-xs text-slate-500">
                <strong>{settings.integrationEnabled ? "On." : "Off."}</strong>{" "}
                {settings.integrationEnabled
                  ? "A document that requires training gets a Training Number and is completed through Training Management."
                  : "Training dates are typed in Document Control, and a Training Number is not issued."}
              </p>
            </div>
            <Switch
              checked={settings.integrationEnabled}
              disabled={!canManage}
              aria-label="Link with Document Control"
              onChange={(checked) => patch({ integrationEnabled: checked })}
            />
          </div>
        </FormSection>
      </div>
    ),
    annual: (
      <FormSection title="Annual Requirement & Retraining" icon={<CalendarClock className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField
            label="Due month"
            hint="Month (1 to 12) by which the annual requirement is due."
            value={settings.annualRequirementDueMonth}
            min={1}
            max={12}
            fallback={1}
            disabled={!canManage}
            onChange={(v) => patch({ annualRequirementDueMonth: v })}
          />
          <NumberField
            label="Due day"
            hint="Day of that month."
            value={settings.annualRequirementDueDay}
            min={1}
            max={31}
            fallback={1}
            disabled={!canManage}
            onChange={(v) => patch({ annualRequirementDueDay: v })}
          />
          <NumberField
            label="Absence limit (months)"
            hint="After a longer absence a person is retrained. A training review for a return after an absence is opened only for an absence longer than this."
            value={settings.absenceRetrainMonths}
            min={1}
            max={60}
            fallback={1}
            disabled={!canManage}
            onChange={(v) => patch({ absenceRetrainMonths: v })}
          />
        </div>
      </FormSection>
    ),
    reminders: (
      <FormSection title="Training Review Reminders" icon={<BellRing className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField
            label="Days before a review ready to close is reminded"
            hint="Every item is settled and the person chosen to close it has not signed. The reminder goes to that person every week."
            value={settings.reviewReadyReminderDays}
            min={1}
            max={60}
            fallback={3}
            disabled={!canManage}
            onChange={(v) => patch({ reviewReadyReminderDays: v })}
          />
          <NumberField
            label="Days before a review with items to do is reminded"
            hint="The person who opened the review is reminded every week."
            value={settings.reviewOpenReminderDays}
            min={1}
            max={365}
            fallback={14}
            disabled={!canManage}
            onChange={(v) => patch({ reviewOpenReminderDays: v })}
          />
        </div>
      </FormSection>
    ),
    retention: (
      <FormSection title="Records Retention" icon={<Archive className="h-4 w-4" />}>
        <NumberField
          label="Years to keep records after the employee leaves"
          hint="Training records are kept at least 10 years after the employee leaves."
          value={settings.retentionYearsAfterLeaving}
          min={10}
          max={100}
          fallback={10}
          disabled={!canManage}
          onChange={(v) => patch({ retentionYearsAfterLeaving: v })}
        />
      </FormSection>
    ),
  } : {};

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Training Properties"
        breadcrumbItems={trainingProperties(navigate)}
        actions={
          settingTab && canManage && settings ? (
            <Button size="sm" variant="outline-emerald" disabled={!isDirty || saving} onClick={() => setShowSaveModal(true)}>
              Save Changes
            </Button>
          ) : tab === "forms" && canAdminister ? (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <IconPlus className="mr-2 h-4 w-4" />
              Upload Template
            </Button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={tabs} activeTab={tab} onChange={changeTab} variant="underline" ariaLabel="Training properties" tabIdPrefix="training-properties-tab" panelIdPrefix="training-properties-panel" />
        <div className="p-4 md:p-5">
          <div id={`training-properties-panel-${tab}`} role="tabpanel" aria-labelledby={`training-properties-tab-${tab}`} className="min-w-0">
        {settingTab && (
          <>
            {loading && (
              <SectionLoading text="Loading training properties..." />
            )}
            {!loading && error && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center">
                <p className="text-sm font-medium text-amber-800">Unable to load training properties.</p>
                <Button size="sm" variant="outline" onClick={load}>
                  Retry
                </Button>
              </div>
            )}
            {!loading && !error && settings && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">{settingTab.about} Changes made in any tab are saved together with Save Changes.</p>
                {panels[settingTab.id]}
              </div>
            )}
          </>
        )}
        {tab === "forms" && canAdminister && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{FORMS_TAB.about}</p>
            <TrainingFormTemplates canEdit={canAdminister} uploadOpen={uploadOpen} onUploadClose={() => setUploadOpen(false)} />
          </div>
        )}
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={() => {
          if (reason.trim()) void save();
        }}
        type="confirm"
        title="Save Training Properties?"
        description={
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              You are about to save changes to Training Properties. This action will be recorded in the Audit Trail.
            </p>
            <FormField label="Reason for the change" required hint={reason.trim() ? undefined : "Enter a reason to save."}>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </FormField>
          </div>
        }
        confirmText="Save Changes"
        cancelText="Cancel"
        isLoading={saving}
      />
    </div>
  );
};
