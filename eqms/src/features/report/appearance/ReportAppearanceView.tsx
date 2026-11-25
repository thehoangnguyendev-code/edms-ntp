import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { IconId } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { flagColor } from "@/utils/status";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField, Input } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { defaultReportLayout, reportError } from "@/services/api/reportTemplates";
import { reportAppearanceApi, type ReportAppearance } from "@/services/api/reportAppearance";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { ReportAppearanceEditor } from "./ReportAppearanceEditor";
import { tr } from "@/i18n";

const STANDARD = "__STANDARD__";

/**
 * One appearance of the reports: its name and its look (logo, header, footer, cover, information, approval block, stamp, watermark). It has its own screen and its own
 * permissions, apart from Report Properties (REPORT-APPEARANCE-PERMISSION-2026-11-14); the list of appearances is the screen before it (REPORT-APPEARANCE-LIST-2026-11-15).
 * At the address "new" the same screen makes a new appearance: from the standard layout, or from a copy of another one (?copyFrom=). The server holds and checks every value.
 */
export const ReportAppearanceView: React.FC = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  // The address "new" is its own route and carries no id; it is read both ways so that it cannot be taken for an appearance.
  const isNew = id === "new" || id === "";
  const copyFrom = searchParams.get("copyFrom") ?? "";
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["reports.appearance.manage"]);

  const [value, setValue] = React.useState<ReportAppearance | null>(null);
  const [original, setOriginal] = React.useState<ReportAppearance | null>(null);
  const [startFrom, setStartFrom] = React.useState(copyFrom || STANDARD);
  const [choices, setChoices] = React.useState<{ label: string; value: string }[]>([{ label: tr("Standard layout (blank)"), value: STANDARD }]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const blank = React.useCallback((name = "", appearance = defaultReportLayout()): ReportAppearance => ({ id: "", name, status: "INACTIVE", version: 0, createdAt: "", updatedAt: "", appearance }), []);

  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    const request = isNew ? (copyFrom ? reportAppearanceApi.get(copyFrom).then((source) => blank(`${source.name} copy`.slice(0, 120), source.appearance)) : Promise.resolve(blank())) : reportAppearanceApi.get(id);
    request
      .then((loaded) => {
        setValue(loaded);
        setOriginal(JSON.parse(JSON.stringify(loaded)));
      })
      .catch((e) => setError(reportError(e)))
      .finally(() => setLoading(false));
  }, [id, isNew, copyFrom, blank]);

  React.useEffect(() => {
    load();
  }, [load]);

  // The appearances that a new one can start from.
  React.useEffect(() => {
    if (!isNew) return;
    let alive = true;
    reportAppearanceApi
      .list({ limit: 100, sort: "name", direction: "asc" })
      .then((result) => alive && setChoices([{ label: tr("Standard layout (blank)"), value: STANDARD }, ...result.data.map((row) => ({ label: row.name, value: row.id }))]))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isNew]);

  const changeStart = (next: string) => {
    setStartFrom(next);
    const source = next === STANDARD ? Promise.resolve(defaultReportLayout()) : reportAppearanceApi.get(next).then((copy) => copy.appearance);
    source.then((appearance) => setValue((previous) => (previous ? { ...previous, appearance } : previous))).catch((e) => setError(reportError(e)));
  };

  const isDirty = !!value && !!original && (isNew ? !!value.name.trim() : JSON.stringify(value.appearance) !== JSON.stringify(original.appearance) || value.name !== original.name);
  // Leaving with a change that was not saved asks first (Back, the breadcrumb, the sidebar, a reload); the move after a successful create is not a leave.
  const { go, modal: leaveModal } = useLeaveGuard(isDirty, isNew ? tr("Create Appearance") : tr("Report Appearance Details"), "the list");

  const save = async () => {
    if (!value) return;
    setSaving(true);
    try {
      if (isNew) {
        const created = await reportAppearanceApi.create(value.name, value.appearance, startFrom === STANDARD ? undefined : startFrom);
        setShowSaveModal(false);
        showToast({ type: "success", title: tr("Appearance created"), message: tr("It is Inactive: activate it from the list when it is ready.") });
        navigate(`/settings/report-appearance/${created.id}`, { replace: true });
        return;
      }
      const saved = await reportAppearanceApi.update(id, { version: value.version, name: value.name, appearance: value.appearance });
      setValue(saved);
      setOriginal(JSON.parse(JSON.stringify(saved)));
      setShowSaveModal(false);
      showToast({ type: "success", title: tr("Changes saved"), message: tr("The report appearance has been updated.") });
    } catch (saveError) {
      setShowSaveModal(false);
      showToast({ type: "error", title: tr("Save failed"), message: reportError(saveError) });
    } finally {
      setSaving(false);
    }
  };

  const title = isNew ? tr("Create Appearance") : tr("Report Appearance Details");
  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(go, title, true, { label: tr("Report Appearance"), onClick: () => go("/settings/report-appearance") })}
        actions={
          value ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline-emerald" onClick={() => go("/settings/report-appearance")} className="whitespace-nowrap">
                {tr("Back")}
              </Button>
              {canManage && (
                <Button size="sm" variant="outline-emerald" disabled={!isDirty || saving} onClick={() => setShowSaveModal(true)}>
                  {tr("Save")}
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <SectionLoading text="Loading report appearance..." />
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

      {!loading && !error && value && (
        <>
          <FormSection
            title={tr("Appearance")}
            icon={<IconId className="h-4 w-4" />}
            headerRight={<Badge color={flagColor(value.status === "ACTIVE")}>{isNew ? "New" : value.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>}
          >
            <div className={isNew ? "grid gap-4 md:grid-cols-2" : undefined}>
              <FormField label={tr("Appearance Name")} required>
                <Input maxLength={120} value={value.name} disabled={!canManage} onChange={(e) => setValue((previous) => (previous ? { ...previous, name: e.target.value } : previous))} />
              </FormField>
              {isNew && <Select label={tr("Start from")} value={startFrom} enableSearch={false} options={choices} onChange={changeStart} />}
            </div>
          </FormSection>
          <ReportAppearanceEditor
            value={value.appearance}
            disabled={!canManage}
            onChange={(appearance) => setValue((previous) => (previous ? { ...previous, appearance } : previous))}
          />
        </>
      )}

      <AlertModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={save}
        type="confirm"
        title={isNew ? tr("Create this appearance?") : tr("Save Report Appearance?")}
        description={
          <p className="text-sm text-slate-600">
            {isNew
              ? `${tr("The new appearance is created Inactive: activate it from the list when it is ready.")} `
              : `${tr("You are about to save changes to the report appearance.")} ${value?.status === "ACTIVE" ? `${tr("It is the Active appearance, so every new report will be drawn with the change.")} ` : ""}`}
            {tr("This action will be recorded in the Audit Trail.")}
          </p>
        }
        confirmText={isNew ? tr("Create") : tr("Save")}
        cancelText={tr("Cancel")}
        isLoading={saving}
      />
      {leaveModal}
    </div>
  );
};
