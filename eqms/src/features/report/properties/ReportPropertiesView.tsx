import React from "react";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { Archive, CalendarClock, FileDigit } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { Button } from "@/components/ui/button/Button";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { reportError } from "@/services/api/reportTemplates";
import { reportPropertiesApi, type ReportProperties } from "@/services/api/reportProperties";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { tr } from "@/i18n";

/** Limits as the server applies them (ReportPropertiesService); the server checks them again. */
const LIMITS = {
  digits: { min: 3, max: 8, fallback: 4 },
  maxRows: { min: 1000, max: 100000, fallback: 10000 },
  maxRowsFull: { min: 10000, max: 100000, fallback: 100000 },
  recipients: { min: 1, max: 500, fallback: 200 },
  retry: { min: 1, max: 60, fallback: 5 },
  rangeDays: { min: 1, max: 3660, fallback: 92 },
} as const;

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-3.5">
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
    {children}
  </div>
);

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
      className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50"
    />
    {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
  </div>
);

/**
 * Report Properties: the settings of the Reports module in one screen, laid out like Document Properties (sections with an icon, groups inside, Save
 * Changes in the header, a confirmation that says the change is recorded in the Audit Trail). The server holds and checks every value.
 */
export const ReportPropertiesView: React.FC = () => {
  const { showToast } = useToast();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["reports.properties.manage"]);

  const [properties, setProperties] = React.useState<ReportProperties | null>(null);
  const [original, setOriginal] = React.useState<ReportProperties | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    reportPropertiesApi
      .get()
      .then((value) => {
        setProperties(value);
        setOriginal(JSON.parse(JSON.stringify(value)));
      })
      .catch((e) => setError(reportError(e)))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const isDirty = JSON.stringify(properties) !== JSON.stringify(original);
  // Leaving with a change that was not saved asks first (the breadcrumb, the links to other pages, the sidebar, a reload).
  const { go, modal: leaveModal } = useLeaveGuard(isDirty, "Report Properties", "another page");
  const patch = (next: Partial<ReportProperties>) => setProperties((prev) => (prev ? { ...prev, ...next } : prev));
  const prefixValid = !!properties && /^[A-Z][A-Z0-9]{1,9}$/.test(properties.templateNumberPrefix);

  /** The next number as it will read with the prefix and digits on the screen (the server issues it). */
  const nextNumber = properties
    ? `${properties.templateNumberPrefix || "…"}${properties.templateNumberSeparator}${String(properties.lastTemplateSerial + 1).padStart(properties.templateNumberDigits, "0")}`
    : "";

  const save = async () => {
    if (!properties) return;
    setSaving(true);
    try {
      const saved = await reportPropertiesApi.update({
        version: properties.version,
        templateNumberPrefix: properties.templateNumberPrefix,
        templateNumberDigits: properties.templateNumberDigits,
        maxRows: properties.maxRows,
        maxRowsFull: properties.maxRowsFull,
        maxScheduleRecipients: properties.maxScheduleRecipients,
        scheduleRetryMinutes: properties.scheduleRetryMinutes,
        maxRangeDays: properties.maxRangeDays,
      });
      setProperties(saved);
      setOriginal(JSON.parse(JSON.stringify(saved)));
      setShowSaveModal(false);
      showToast({ type: "success", title: tr("Changes saved"), message: "Report properties have been updated." });
    } catch (saveError) {
      setShowSaveModal(false);
      showToast({ type: "error", title: tr("Save failed"), message: reportError(saveError) });
    } finally {
      setSaving(false);
    }
  };

  const title = "Report Properties";
  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(go, title, true)}
        actions={
          canManage && properties ? (
            <Button size="sm" variant="outline-emerald" disabled={!isDirty || !prefixValid || saving} onClick={() => setShowSaveModal(true)}>
              {tr("Save")}
            </Button>
          ) : undefined
        }
      />

      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <SectionLoading text="Loading report properties..." />
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center">
          <p role="alert" className="text-sm font-medium text-amber-800">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>
            {tr("Retry")}
          </Button>
        </div>
      )}

      {!loading && !error && properties && (
        <div className="space-y-4">
          {/* 1. How report templates are numbered and named */}
          <FormSection title={tr("Template Numbering & Name")} icon={<FileDigit className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Group title={tr("Template number")}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("Prefix")}</label>
                    <input
                      type="text"
                      maxLength={10}
                      disabled={!canManage}
                      value={properties.templateNumberPrefix}
                      onChange={(e) => patch({ templateNumberPrefix: e.target.value.toUpperCase() })}
                      className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50"
                    />
                    <p className={`mt-1.5 text-xs ${prefixValid ? "text-slate-500" : "text-red-600"}`}>{tr("2 to 10 upper-case letters or digits, starting with a letter.")}</p>
                  </div>
                  <NumberField
                    label={tr("Digits of the Serial Number")}
                    value={properties.templateNumberDigits}
                    min={LIMITS.digits.min}
                    max={LIMITS.digits.max}
                    fallback={LIMITS.digits.fallback}
                    disabled={!canManage}
                    onChange={(v) => patch({ templateNumberDigits: v })}
                  />
                  <div className="min-w-0">
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("Next template number")}</label>
                    <input type="text" readOnly value={nextNumber} className={CONTROL_STATE_CLASSES.readonlyField} />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("Last serial issued")}</label>
                    <input type="text" readOnly value={properties.lastTemplateSerial} className={CONTROL_STATE_CLASSES.readonlyField} />
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {tr("The system gives every new report template its number; nobody types it. The serial only moves forward, so a number is never issued twice. A change applies only to numbers issued after saving; templates that exist keep their number.")}
                </p>
              </Group>

              <Group title={tr("Template name")}>
                <p className="text-sm text-slate-700">{tr("A new template is named by the active Report Name Format. Nobody chooses a rule.")}</p>
                <p className="text-xs text-slate-500">
                  {tr("Only one format is active at a time; enabling another disables the one that was active. A template keeps the name it has when the active format changes. Manage the formats under")}{" "}
                  <button type="button" onClick={() => go("/settings/report-name-formats")} className="font-medium text-emerald-700 underline underline-offset-2">
                    {tr("Report Name Formats")}
                  </button>
                  .
                </p>
              </Group>
            </div>
          </FormSection>

          {/* 3. Size of a report and how long files are kept */}
          <FormSection title={tr("Report Size & Retention")} icon={<Archive className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Group title={tr("Report file")}>
                <NumberField
                  label={tr("Most rows in a report file")}
                  hint={tr("A report that would hold more rows is refused when it is requested, so that a file stays complete and readable. Reports already made are not affected.")}
                  value={properties.maxRows}
                  min={LIMITS.maxRows.min}
                  max={LIMITS.maxRows.max}
                  fallback={LIMITS.maxRows.fallback}
                  disabled={!canManage}
                  onChange={(v) => patch({ maxRows: v })}
                />
                <NumberField
                  label={tr("Most rows in a report file run with Full")}
                  hint={tr("A report is run with a filter. A person who chooses Full runs it without one, up to this many rows, as a CSV or XLSX file; a PDF or Word file keeps the limit above. Every Full run is written to the Audit Trail. The limit cannot be higher than the report service can hold in memory.")}
                  value={properties.maxRowsFull}
                  min={Math.max(LIMITS.maxRowsFull.min, properties.maxRows)}
                  max={LIMITS.maxRowsFull.max}
                  fallback={LIMITS.maxRowsFull.fallback}
                  disabled={!canManage}
                  onChange={(v) => patch({ maxRowsFull: v })}
                />
                <NumberField
                  label={tr("Most days a report may cover")}
                  hint={tr("For the report types that must name a period (Audit Trail, Authentication Events, Backup Activity, Electronic Signatures, Notification Delivery): a report that covers more days is refused when it is requested. A longer period also needs a higher row limit above, or the report is refused for its size.")}
                  value={properties.maxRangeDays}
                  min={LIMITS.rangeDays.min}
                  max={LIMITS.rangeDays.max}
                  fallback={LIMITS.rangeDays.fallback}
                  disabled={!canManage}
                  onChange={(v) => patch({ maxRangeDays: v })}
                />
              </Group>

              <Group title={tr("Retention")}>
                <p className="text-sm text-slate-700">{tr("Report files are kept permanently. No file expires by age.")}</p>
                <p className="text-xs text-slate-500">
                  {tr("A legal hold still blocks any removal. Holds are placed and released on each run's page; the files held now are listed under")}{" "}
                  <button type="button" onClick={() => go(ROUTES.REPORT.LEGAL_HOLDS)} className="font-medium text-emerald-700 underline underline-offset-2">
                    {tr("Legal Hold Register")}
                  </button>
                  .
                </p>
              </Group>
            </div>
          </FormSection>

          {/* 4. Scheduled reports */}
          <FormSection title={tr("Scheduled Reports")} icon={<CalendarClock className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Group title={tr("Recipients")}>
                <NumberField
                  label={tr("Most recipients of a schedule")}
                  hint={tr("The most people a scheduled report may be sent to.")}
                  value={properties.maxScheduleRecipients}
                  min={LIMITS.recipients.min}
                  max={LIMITS.recipients.max}
                  fallback={LIMITS.recipients.fallback}
                  disabled={!canManage}
                  onChange={(v) => patch({ maxScheduleRecipients: v })}
                />
              </Group>

              <Group title={tr("Retry")}>
                <NumberField
                  label={tr("Retry after a temporary failure (minutes)")}
                  hint={tr("When a schedule cannot run because of a temporary failure of the system, it is tried again after this time. A schedule whose template is disabled or not approved is suspended and the people responsible are told.")}
                  value={properties.scheduleRetryMinutes}
                  min={LIMITS.retry.min}
                  max={LIMITS.retry.max}
                  fallback={LIMITS.retry.fallback}
                  disabled={!canManage}
                  onChange={(v) => patch({ scheduleRetryMinutes: v })}
                />
              </Group>
            </div>
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-800">
              {tr("Who may write, approve, upgrade or disable a report template, and who may run reports, is decided by permissions. Assign them to the Access Profiles that need them at")}{" "}
              <button type="button" onClick={() => go(ROUTES.SECURITY.ACCESS_PROFILES)} className="font-medium underline underline-offset-2 hover:text-sky-900">
                {tr("Security & Authorization > Access Profiles")}
              </button>
              .
            </div>
          </FormSection>
        </div>
      )}

      <AlertModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={save}
        type="confirm"
        title={tr("Save Report Properties?")}
        description={<p className="text-sm text-slate-600">{tr("You are about to save changes to Report Properties. This action will be recorded in the Audit Trail.")}</p>}
        confirmText="Save"
        cancelText="Cancel"
        isLoading={saving}
      />
      {leaveModal}
    </div>
  );
};
