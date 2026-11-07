import React from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Archive, BellRing, CalendarClock, FileText, GraduationCap, NotebookPen, RotateCcw, Send, Timer, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { Button } from "@/components/ui/button/Button";
import { TrainingNumberCountersPanel } from "./TrainingNumberCountersPanel";
import { FormSection } from "@/components/ui/form/FormSection";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { Switch } from "@/components/ui/switch/Switch";
import { Select } from "@/components/ui/select/Select";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { trainingProperties } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { trainingError, trainingSettingsApi, type TrainingSettings } from "@/services/api/trainingActivities";

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
    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{label}</label>
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
  { id: "assessment", label: "Assessment", about: "How a test is marked, and by when the trainer must finish the training, which sends the results to QA. It is used when the trainer records the results of a training." },
  { id: "documents", label: "Document Training", about: "How training on a new or revised document is organised. A document that requires training always goes through Training Management; this is used when it is created in Document Control." },
  { id: "annual", label: "Annual & Retraining", about: "When the annual requirement is due, when a person who was away is retrained, and how long a person counts as a new employee. It is used by the training requirements, the training reviews and Training Compliance." },
  { id: "reminders", label: "Reminders", about: "When a person who has not signed a self-reading is reminded before the due date, and when the person who must close a training review, and the person who opened it, are reminded (once a week)." },
  { id: "files", label: "File Names", about: "The name of the file a person downloads for each form (APD.0011, 0014, 0024, 0108, 0117, 0118). Write the name with variables in braces; the example shows the result. It is used every time a form is downloaded as Word or PDF." },
  { id: "retention", label: "Records Retention", about: "How long training records are kept. It is used when the records of a person who left are archived." },
] as const;

const SAMPLE: Record<string, string> = { EMPLOYEE_CODE: "NT-0123", EMPLOYEE_NAME: "Nguyen-Van-An", DEPARTMENT: "Quality-Control", TRAINING_NUMBER: "TRN-QC-26-045", SESSION_NO: "01", MATRIX_CODE: "TM-QC", VERSION: "3", ISSUE_NO: "2", REQUEST_NO: "TR-QC-26-001", YEAR: "2026", DATE: "20261101" };

/** The example while the pattern is typed (the server gives the exact one when it is saved): the same variables, with sample values. */
export const previewFileName = (form: { form: string; defaultPattern: string }, pattern: string) => {
  const code = `${form.form.replace(".BATCH", "")}.02`;
  const make = (text: string) => text.replace(/\{([A-Z_]+)\}/g, (_m, name: string) => (name === "FILE_CODE" ? code : (SAMPLE[name] ?? ""))).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").replace(/^[-_.]+|[-_.]+$/g, "");
  return `${make(pattern) || make(form.defaultPattern)}${form.form.endsWith("BATCH") ? ".zip" : ".pdf"}`;
};

/** A pattern that the server would refuse, said before saving. */
export const fileNameProblem = (f: { pattern: string; variables: { name: string }[] }) => {
  const p = f.pattern.trim();
  if (!p) return "";
  if (/[\\/:*?"<>|]/.test(p)) return "A file name cannot hold \\ / : * ? \" < > |";
  const used = [...p.matchAll(/\{([A-Z_]+)\}/g)].map((m) => m[1]);
  const unknown = used.find((n) => !f.variables.some((v) => v.name === n));
  if (unknown) return `{${unknown}} is not a variable of this form`;
  if (used.length === 0) return "The pattern needs at least one variable, otherwise every file has the same name";
  if (/[{}]/.test(p.replace(/\{[A-Z_]+\}/g, ""))) return "A brace is not closed";
  return "";
};

/** Settings are version-checked and changes are recorded in the Audit Trail. */
export const TrainingPropertiesView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.settings.manage");

  const [params, setParams] = useSearchParams();
  const tabs: TabItem[] = [
    ...SETTING_TABS.map(({ id, label }) => ({ id, label })),
    // Not a setting: the counters of the Training Numbers are raised on their own, not saved with the settings.
    { id: "numbers", label: "Number Counters" },
  ];
  const requested = params.get("tab");
  const tab = tabs.some((x) => x.id === requested) ? (requested as string) : SETTING_TABS[0].id;
  const changeTab = (id: string) => setParams(id === SETTING_TABS[0].id ? {} : { tab: id }, { replace: true });
  const settingTab = SETTING_TABS.find((x) => x.id === tab);

  const [settings, setSettings] = React.useState<TrainingSettings | null>(null);
  const [original, setOriginal] = React.useState<TrainingSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

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
  const hasFileNameProblem = Boolean(settings?.downloadFileNames.some((f) => fileNameProblem(f)));
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
        resultsDueDayType: settings.resultsDueDayType,
        initialTrainingDays: settings.initialTrainingDays,
        warnScheduledAfterDue: settings.warnScheduledAfterDue,
        selfReadingReminderFirstDays: settings.selfReadingReminderFirstDays,
        selfReadingReminderSecondDays: settings.selfReadingReminderSecondDays,
        makeupReminderDays: settings.makeupReminderDays,
        trainingNumberEntryMode: settings.trainingNumberEntryMode,
        // only the forms whose pattern was changed are sent; the default pattern is sent as empty (the default is then used)
        downloadFileNames: Object.fromEntries(settings.downloadFileNames.filter((f) => f.pattern !== original?.downloadFileNames.find((o) => o.form === f.form)?.pattern).map((f) => [f.form, f.pattern === f.defaultPattern ? "" : f.pattern])),
        version: settings.version,
      });
      setSettings(saved);
      setOriginal(JSON.parse(JSON.stringify(saved)));
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
            label="Days to finish the training and send the results to QA"
            hint="SOP.0003 5.3.7: the results go to QA within 7 working days from the day the training was held; the number is the company's to set. This is the deadline, not a wait: Finish Training sends the results at once, and the trainer is reminded on the last day, then every week while it is late."
            value={settings.resultsDueDays}
            min={1}
            max={60}
            fallback={7}
            disabled={!canManage}
            onChange={(v) => patch({ resultsDueDays: v })}
          />
          <div className="mt-4 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">Which days are counted</label>
            <Select
              value={settings.resultsDueDayType}
              enableSearch={false}
              disabled={!canManage}
              onChange={(v) => patch({ resultsDueDayType: v as TrainingSettings["resultsDueDayType"] })}
              options={[
                { label: "Working days: Monday to Friday", value: "WORKING_MON_FRI" },
                { label: "Working days: Monday to Saturday", value: "WORKING_MON_SAT" },
                { label: "Every day (calendar days)", value: "CALENDAR" },
              ]}
            />
            <p className="text-xs text-slate-500 mt-1">The public holidays are not known to the system: a holiday counts as a working day.</p>
          </div>
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
        <FormSection title="Training Number" icon={<FileText className="h-4 w-4" />} className="h-full">
          <div className="space-y-2">
            <Select
              label="How the Training Number is given"
              value={settings.trainingNumberEntryMode ?? "AUTO"}
              disabled={!canManage}
              onChange={(value) => patch({ trainingNumberEntryMode: value === "MANUAL" ? "MANUAL" : "AUTO" })}
              options={[
                { value: "AUTO", label: "Automatic" },
                { value: "MANUAL", label: "Manual" },
              ]}
            />
            <p className="text-xs text-slate-500">
              {settings.trainingNumberEntryMode === "MANUAL"
                ? "The person creating the document types the number."
                : "The system issues the number when Requires Training is saved."}
            </p>
          </div>
          {settings.trainingNumberEntryMode === "MANUAL" && (
            <p className="mt-3 text-xs text-slate-500">
              The number is typed as TRN/&lt;department code&gt;/&lt;YY&gt;-&lt;NNN&gt;. The screen warns at once when it is already used, and warns (without refusing) when the
              year is not the current one. It can be changed, with a reason, until the training opens. A training created without that screen (for example by upgrading a
              revision) still gets a number from the system, which can then be changed the same way.
            </p>
          )}
        </FormSection>
        <FormSection title="Scheduling" icon={<CalendarClock className="h-4 w-4" />} className="h-full">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Warn when a session is scheduled after the due date</p>
              <p className="mt-1 text-xs text-slate-500">
                <strong>{settings.warnScheduledAfterDue ? "On." : "Off."}</strong>{" "}
                The session can still be saved; the activity shows that the day is after the due date.
              </p>
            </div>
            <Switch
              checked={settings.warnScheduledAfterDue}
              disabled={!canManage}
              aria-label="Warn when a session is scheduled after the due date"
              onChange={(checked) => patch({ warnScheduledAfterDue: checked })}
            />
          </div>
        </FormSection>
      </div>
    ),
    annual: (
      <div className="space-y-4">
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
      <FormSection title="New Employees" icon={<UserPlus className="h-4 w-4" />}>
        <div className="max-w-md">
          <NumberField
            label="Days a person counts as a new employee"
            hint="SOP.0003 5.1: a new employee has an initial training of three parts. A person who started within this number of days shows the label New employee in Training Compliance, Initial Training. The start is the start date of the person, or the day the account was created."
            value={settings.initialTrainingDays}
            min={1}
            max={730}
            fallback={90}
            disabled={!canManage}
            onChange={(v) => patch({ initialTrainingDays: v })}
          />
        </div>
      </FormSection>
      </div>
    ),
    reminders: (
      <div className="space-y-4">
      <FormSection title="Self-reading Reminders" icon={<BellRing className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField
            label="First reminder: days before the due date"
            hint="Every invited person who has not read and signed a self-reading receives an e-mail and a notice this many days before the due date of the training. Must be more than the second reminder."
            value={settings.selfReadingReminderFirstDays}
            min={1}
            max={30}
            fallback={3}
            disabled={!canManage}
            onChange={(v) => patch({ selfReadingReminderFirstDays: v })}
          />
          <NumberField
            label="Second reminder: days before the due date"
            hint="The same reminder once more, closer to the due date. The trainer can also remind one person at any time with Send Reminder in the Reading step."
            value={settings.selfReadingReminderSecondDays}
            min={1}
            max={30}
            fallback={1}
            disabled={!canManage}
            onChange={(v) => patch({ selfReadingReminderSecondDays: v })}
          />
          <NumberField
            label="Make-up reminder: days after the due date"
            hint="SOP.0003 5.3.7 leaves the rescheduling of an absent person to the organizer. This many days after the due date of a training, and every week after, the organizer is told of each person still absent whom no supplementary training lists. People who left the company or are suspended are not chased."
            value={settings.makeupReminderDays}
            min={1}
            max={365}
            fallback={14}
            disabled={!canManage}
            onChange={(v) => patch({ makeupReminderDays: v })}
          />
        </div>
      </FormSection>
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
      </div>
    ),
    files: (
      <div className="space-y-4">
        {settings.downloadFileNames.map((f) => (
          <FormSection key={f.form} title={f.label} icon={<FileText className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="min-w-0">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5" htmlFor={`file-name-${f.form}`}>File name pattern</label>
                <input
                  id={`file-name-${f.form}`}
                  type="text"
                  maxLength={200}
                  disabled={!canManage}
                  value={f.pattern}
                  onChange={(e) => patch({ downloadFileNames: settings.downloadFileNames.map((x) => (x.form === f.form ? { ...x, pattern: e.target.value, example: previewFileName(x, e.target.value) } : x)) })}
                  className="w-full h-9 px-3.5 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50"
                />
              </div>
              {canManage && (
                <Button size="sm" variant="outline-emerald" disabled={f.pattern === f.defaultPattern} onClick={() => patch({ downloadFileNames: settings.downloadFileNames.map((x) => (x.form === f.form ? { ...x, pattern: x.defaultPattern, example: previewFileName(x, x.defaultPattern) } : x)) })}>
                   Default
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">Example: <span className="font-mono text-slate-800" data-testid={`file-name-example-${f.form}`}>{f.example}</span></p>
            <p className="mt-1 text-xs text-slate-500">
              Variables:{" "}
              {f.variables.map((v) => (
                <span key={v.name} title={v.meaning} className="mr-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">{`{${v.name}}`}</span>
              ))}
            </p>
            {fileNameProblem(f) && <p className="mt-1 text-xs text-red-600" role="alert">{fileNameProblem(f)}</p>}
          </FormSection>
        ))}
        <p className="text-xs text-slate-500">Accents are taken out, a blank becomes "-", and the characters \ / : * ? " &lt; &gt; | never appear in a name. A name is at most 120 characters. An empty pattern brings back the default.</p>
      </div>
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
            <Button size="sm" variant="outline-emerald" disabled={!isDirty || saving || hasFileNameProblem} onClick={() => setShowSaveModal(true)}>
              Save Changes
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
        {tab === "numbers" && <TrainingNumberCountersPanel canManage={canManage} />}
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={() => { void save(); }}
        type="confirm"
        title="Save Training Properties?"
        description="You are about to save changes to Training Properties. The previous and new values will be recorded in the Audit Trail."
        confirmText="Save Changes"
        cancelText="Cancel"
        isLoading={saving}
      />
    </div>
  );
};
