import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button/Button";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Select } from "@/components/ui/select";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { ScheduleRecipientsField } from "./ScheduleRecipientsField";
import { ScheduleFrequencyField } from "./ScheduleFrequencyField";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { ReportLookup } from "../templates/ReportLookup";
import {
  reportsApi,
  type ReportFormat,
  type ReportScheduleDetail,
} from "@/services/api/reports";
import { reportError, type ReportTemplate } from "@/services/api/reportTemplates";

const blank = (): ReportScheduleDetail => ({
  id: "",
  version: 1,
  name: "",
  definitionCode: "",
  cronExpression: "0 0 8 * * MON-FRI",
  format: "PDF",
  recipientUserIds: [],
  parameters: {},
  fields: [],
});

/**
 * One report schedule on a page of its own (new or edit), like the other detail pages of the system. It replaces the side drawer of the
 * Scheduled Reports list. The server checks every rule again on save.
 */
export function ScheduleEditorPage() {
  const { id = "new" } = useParams();
  const create = id === "new";
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["reports.schedule.manage", "report.module.export"]);
  const [draft, setDraft] = useState<ReportScheduleDetail>(blank());
  const [catalog, setCatalog] = useState<ReportTemplate[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(!create);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    reportsApi
      .catalog()
      .then((value) => alive && setCatalog(value as ReportTemplate[]))
      .catch((e) => alive && setError(reportError(e)));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (create) return;
    let alive = true;
    setLoading(true);
    reportsApi
      .scheduleDetail(id)
      .then((value) => alive && setDraft(value))
      .catch((e) => alive && setError(reportError(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, create]);
  const patch = (p: Partial<ReportScheduleDetail>) => setDraft((v) => ({ ...v, ...p }));
  const template = catalog.find((t) => t.code === draft.definitionCode);
  const title = create ? "New Report Schedule" : "Edit Report Schedule";
  const back = () => navigate("/report/scheduled");
  const canSave = canManage && !!draft.name.trim() && !!draft.definitionCode && (create || !!reason.trim());

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (draft.id) await reportsApi.updateSchedule(draft.id, draft.version, draft, reason);
      else await reportsApi.createSchedule(draft);
      showToast({ type: "success", title: "Scheduled report saved", message: "Changes apply to future occurrences." });
      back();
    } catch (e) {
      setError(reportError(e));
    } finally {
      setSaving(false);
    }
  };

  const [activeTab, setActiveTab] = useState("general");
  // The same tab layout as the Report Template Details and the Document details.
  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "general", label: "General Information" },
      { id: "criteria", label: "Criteria & Columns", count: template ? (draft.fields?.length ?? 0) : undefined },
      { id: "recipients", label: "Recipients", count: draft.recipientUserIds?.length ?? 0 },
    ],
    [template, draft.fields, draft.recipientUserIds],
  );
  const actions = (
    <>
      <Button size="sm" variant="outline-emerald" disabled={saving} onClick={back} className="whitespace-nowrap touch-manipulation">
        Back
      </Button>
      {canManage && (
        <Button size="sm" variant="outline-emerald" loading={saving} disabled={!canSave} onClick={() => void save()} className="whitespace-nowrap touch-manipulation">
          Save
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(navigate, title, false, { label: "Scheduled Reports", onClick: back })}
        actions={actions}
      />
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <SectionLoading text="Loading report schedule…" />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <TabNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} layoutId="report-schedule-editor-tab" />
            <fieldset disabled={saving || !canManage} className="m-0 min-w-0 space-y-4 border-0 p-4 md:p-5">
              {activeTab === "general" && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                  <FormField label="Schedule Name" required>
                    <Input maxLength={255} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
                  </FormField>
                  <Select
                    label="Report Template"
                    value={draft.definitionCode}
                    disabled={!!draft.id}
                    options={[
                      ...catalog.map((t) => ({ value: t.code, label: t.displayName })),
                      ...(draft.definitionCode && !template ? [{ value: draft.definitionCode, label: draft.definitionName ?? draft.definitionCode }] : []),
                    ]}
                    onChange={(code) => {
                      const t = catalog.find((x) => x.code === String(code));
                      patch({
                        definitionCode: String(code),
                        format: t?.allowedFormats[0] ?? "PDF",
                        parameters: {},
                        fields:
                          t?.fields
                            .filter((f) => f.allowed && (f.required || f.defaultSelected || t.layout?.charts?.some((c) => c.field === f.code)))
                            .map((f) => f.code) ?? [],
                      });
                    }}
                  />
                  <FormField label="Generated Report Name" hint="Optional. The name written on the report; the template name is used when empty.">
                    <Input
                      maxLength={255}
                      value={String(draft.parameters?.reportTitle ?? "")}
                      placeholder={template?.displayName}
                      onChange={(e) => {
                        const params = { ...draft.parameters };
                        if (e.target.value) params.reportTitle = e.target.value;
                        else delete params.reportTitle;
                        patch({ parameters: params });
                      }}
                    />
                  </FormField>
                  <Select
                    label="Output Format"
                    value={draft.format}
                    options={(template?.allowedFormats ?? draft.allowedFormats ?? [draft.format]).map((v) => ({ value: v, label: v }))}
                    enableSearch={false}
                    onChange={(v) => patch({ format: v as ReportFormat })}
                  />
                  <ScheduleFrequencyField cron={draft.cronExpression} onChange={(cron) => patch({ cronExpression: cron })} />
                  {!create && (
                    <div className="md:col-span-2">
                      <FormField label="Reason For The Change" required>
                        <Textarea rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
                      </FormField>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "criteria" &&
                (!template ? (
                  <p className="text-sm text-slate-500">
                    {draft.definitionCode
                      ? "This template is not available to run now (it may not be approved, or it is outside your scope), so its criteria and columns cannot be changed here."
                      : "Choose a Report Template on General Information to set its criteria and columns."}
                  </p>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500">A scheduled report runs without anyone watching, so it needs at least one filter. It cannot be run with Full.</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                      {template.filterFields?.map((f) =>
                        f.type === "LOOKUP" ? (
                          <ReportLookup
                            key={f.code}
                            code={template.code}
                            field={f.code}
                            label={f.name}
                            value={String(draft.parameters?.[f.code] ?? "")}
                            onChange={(v) => patch({ parameters: { ...draft.parameters, [f.code]: v } })}
                          />
                        ) : f.type === "DATE" ? (
                          <DateTimePicker
                            key={f.code}
                            label={f.name}
                            showTime={false}
                            value={String(draft.parameters?.[f.code] ?? "")}
                            onChange={(v) => {
                              const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                              patch({ parameters: { ...draft.parameters, [f.code]: m ? `${m[3]}-${m[2]}-${m[1]}` : v } });
                            }}
                          />
                        ) : (
                          <FormField key={f.code} label={f.name}>
                            <Input
                              type={f.type === "NUMBER" ? "number" : "text"}
                              value={String(draft.parameters?.[f.code] ?? "")}
                              onChange={(e) => patch({ parameters: { ...draft.parameters, [f.code]: e.target.value } })}
                            />
                          </FormField>
                        ),
                      )}
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-slate-700 sm:text-sm">Included Columns</p>
                      <div className="grid grid-cols-1 gap-x-4 gap-y-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
                        {template.fields
                          .filter((f) => f.allowed)
                          .map((f) => (
                            <Checkbox
                              key={f.code}
                              label={f.name}
                              checked={draft.fields?.includes(f.code) ?? false}
                              disabled={f.required || template.layout?.charts?.some((c) => c.field === f.code)}
                              onChange={(on) =>
                                patch({
                                  fields: on ? [...(draft.fields ?? []), f.code] : (draft.fields ?? []).filter((c) => c !== f.code),
                                })
                              }
                            />
                          ))}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Required columns and chart fields stay included.</p>
                    </div>
                  </div>
                ))}
              {activeTab === "recipients" && (
                <ScheduleRecipientsField
                  people={draft.recipients ?? []}
                  disabled={!canManage}
                  onChange={(people) => patch({ recipients: people, recipientUserIds: people.map((person) => person.id) })}
                />
              )}
            </fieldset>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {actions}
          </div>
        </>
      )}
    </div>
  );
}
