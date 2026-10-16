import React from "react";
import { useNavigate } from "react-router-dom";
import { Archive, CalendarClock, FileDigit, Palette } from "lucide-react";
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
import { ReportLayoutDesigner } from "../templates/ReportLayoutDesigner";

/** Limits as the server applies them (ReportPropertiesService); the server checks them again. */
const LIMITS = {
  digits: { min: 3, max: 8, fallback: 4 },
  maxRows: { min: 1000, max: 100000, fallback: 10000 },
  recipients: { min: 1, max: 500, fallback: 200 },
  retry: { min: 1, max: 60, fallback: 5 },
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
 * Report Properties: the settings of the Reports module in one screen, laid out like Document Properties (sections with an icon, groups inside, Save
 * Changes in the header, a confirmation that says the change is recorded in the Audit Trail). The server holds and checks every value.
 */
export const ReportPropertiesView: React.FC = () => {
  const navigate = useNavigate();
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
        maxScheduleRecipients: properties.maxScheduleRecipients,
        scheduleRetryMinutes: properties.scheduleRetryMinutes,
        appearance: properties.appearance,
      });
      setProperties(saved);
      setOriginal(JSON.parse(JSON.stringify(saved)));
      setShowSaveModal(false);
      showToast({ type: "success", title: "Changes saved", message: "Report properties have been updated." });
    } catch (saveError) {
      setShowSaveModal(false);
      showToast({ type: "error", title: "Save failed", message: reportError(saveError) });
    } finally {
      setSaving(false);
    }
  };

  const title = "Report Properties";
  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(navigate, title, true)}
        actions={
          canManage && properties ? (
            <Button size="sm" variant="outline-emerald" disabled={!isDirty || !prefixValid || saving} onClick={() => setShowSaveModal(true)}>
              Save Changes
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
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && properties && (
        <div className="space-y-4">
          {/* 1. How report templates are numbered and named */}
          <FormSection title="Template Numbering & Name" icon={<FileDigit className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Group title="Template number">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Prefix</label>
                    <input
                      type="text"
                      maxLength={10}
                      disabled={!canManage}
                      value={properties.templateNumberPrefix}
                      onChange={(e) => patch({ templateNumberPrefix: e.target.value.toUpperCase() })}
                      className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50"
                    />
                    <p className={`text-xs mt-1 ${prefixValid ? "text-slate-500" : "text-red-600"}`}>2 to 10 upper-case letters or digits, starting with a letter.</p>
                  </div>
                  <NumberField
                    label="Digits of the Serial Number"
                    value={properties.templateNumberDigits}
                    min={LIMITS.digits.min}
                    max={LIMITS.digits.max}
                    fallback={LIMITS.digits.fallback}
                    disabled={!canManage}
                    onChange={(v) => patch({ templateNumberDigits: v })}
                  />
                  <div className="min-w-0">
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Next template number</label>
                    <input type="text" readOnly value={nextNumber} className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-600 cursor-default" />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Last serial issued</label>
                    <input type="text" readOnly value={properties.lastTemplateSerial} className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-600 cursor-default" />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  The system gives every new report template its number; nobody types it. The serial only moves forward, so a number is never issued twice. A change
                  applies only to numbers issued after saving; templates that exist keep their number.
                </p>
              </Group>

              <Group title="Template name">
                <p className="text-sm text-slate-700">A new template is named by the active Report Name Format. Nobody chooses a rule.</p>
                <p className="text-xs text-slate-500">
                  Only one format is active at a time; enabling another disables the one that was active. A template keeps the name it has when the active format changes. Manage the
                  formats under{" "}
                  <button type="button" onClick={() => navigate("/settings/report-name-formats")} className="font-medium text-emerald-700 underline underline-offset-2">
                    Report Name Formats
                  </button>
                  .
                </p>
              </Group>
            </div>
          </FormSection>

          {/* 2. The one appearance of every report */}
          <FormSection title="Report Appearance" icon={<Palette className="h-4 w-4" />}>
            <p className="mb-4 text-xs text-slate-500">
              Every report uses this one company appearance: its stamp, watermark, logo, font, paper layout and the header, footer and cover. A report template chooses only
              what the report contains and its charts. A change applies to reports made after saving; a report already made keeps the look it was made with.
            </p>
            <ReportLayoutDesigner
              value={properties.appearance}
              title="Report preview"
              disabled={!canManage}
              onChange={(appearance) => patch({ appearance })}
            />
          </FormSection>

          {/* 3. Size of a report and how long files are kept */}
          <FormSection title="Report Size & Retention" icon={<Archive className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Group title="Report file">
                <NumberField
                  label="Most rows in a report file"
                  hint="A report that would hold more rows is refused when it is requested, so that a file stays complete and readable. Reports already made are not affected."
                  value={properties.maxRows}
                  min={LIMITS.maxRows.min}
                  max={LIMITS.maxRows.max}
                  fallback={LIMITS.maxRows.fallback}
                  disabled={!canManage}
                  onChange={(v) => patch({ maxRows: v })}
                />
              </Group>

              <Group title="Retention">
                <p className="text-sm text-slate-700">Report files are kept permanently. No file expires by age.</p>
                <p className="text-xs text-slate-500">
                  A legal hold still blocks any removal. Holds are placed and released on each run's page; the files held now are listed under{" "}
                  <button type="button" onClick={() => navigate(ROUTES.SETTINGS.REPORT_ADMINISTRATION.RETENTION)} className="font-medium text-emerald-700 underline underline-offset-2">
                    Report Retention &amp; Legal Hold
                  </button>
                  .
                </p>
              </Group>
            </div>
          </FormSection>

          {/* 4. Scheduled reports */}
          <FormSection title="Scheduled Reports" icon={<CalendarClock className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Group title="Recipients">
                <NumberField
                  label="Most recipients of a schedule"
                  hint="The most people a scheduled report may be sent to."
                  value={properties.maxScheduleRecipients}
                  min={LIMITS.recipients.min}
                  max={LIMITS.recipients.max}
                  fallback={LIMITS.recipients.fallback}
                  disabled={!canManage}
                  onChange={(v) => patch({ maxScheduleRecipients: v })}
                />
              </Group>

              <Group title="Retry">
                <NumberField
                  label="Retry after a temporary failure (minutes)"
                  hint="When a schedule cannot run because of a temporary failure of the system, it is tried again after this time. A schedule whose template is disabled or not approved is suspended and the people responsible are told."
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
              Who may write, approve, upgrade or disable a report template, and who may run reports, is decided by permissions. Assign them to the Access Profiles that need
              them at{" "}
              <button type="button" onClick={() => navigate(ROUTES.SECURITY.ACCESS_PROFILES)} className="font-medium underline underline-offset-2 hover:text-sky-900">
                Security &amp; Authorization &gt; Access Profiles
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
        title="Save report properties?"
        description={<p className="text-sm text-slate-600">You are about to save changes to Report Properties. This action will be recorded in the Audit Trail.</p>}
        confirmText="Save Changes"
        cancelText="Cancel"
        isLoading={saving}
      />
    </div>
  );
};
