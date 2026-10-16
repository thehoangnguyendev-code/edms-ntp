import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button/Button";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormSection } from "@/components/ui/form/FormSection";
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
  type ReportRecipientCandidate,
  type ReportScheduleDetail,
} from "@/services/api/reports";
import { reportError, type ReportTemplate } from "@/services/api/reportTemplates";

const inputClass = "mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm";
const FREQUENCIES = ["0 0 8 * * *", "0 0 8 * * MON-FRI", "0 0 8 * * MON", "0 0 8 1 * *"];
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
  const [recipientInput, setRecipientInput] = useState("");
  const [candidates, setCandidates] = useState<ReportRecipientCandidate[]>([]);

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
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      reportsApi
        .listScheduleRecipients(recipientInput)
        .then((value) => alive && setCandidates(value))
        .catch((e) => alive && setError(reportError(e)));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [recipientInput]);

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

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(navigate, title, false, { label: "Scheduled Reports", onClick: back })}
        actions={
          <>
            <Button size="sm" variant="outline-emerald" disabled={saving} onClick={back} className="whitespace-nowrap touch-manipulation">
              Back
            </Button>
            {canManage && (
              <Button size="sm" variant="outline-emerald" loading={saving} disabled={!canSave} onClick={() => void save()} className="whitespace-nowrap touch-manipulation">
                Save Changes
              </Button>
            )}
          </>
        }
      />
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <SectionLoading text="Loading report schedule…" />
      ) : (
        <fieldset disabled={saving || !canManage} className="m-0 min-w-0 border-0 p-0">
          <div className="grid min-w-0 grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
            <div className="min-w-0 space-y-4 md:space-y-6">
              <FormSection title="Schedule Information">
                <div className="space-y-4">
                  <label className="block text-sm text-slate-700">
                    Schedule name <span className="text-red-600">*</span>
                    <Input className={inputClass} maxLength={255} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
                  </label>
                  <Select
                    label="Report template"
                    value={draft.definitionCode}
                    disabled={!!draft.id}
                    options={catalog.map((t) => ({ value: t.code, label: t.displayName }))}
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
                  <label className="block text-sm text-slate-700">
                    Report name (optional)
                    <Input
                      className={inputClass}
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
                  </label>
                </div>
              </FormSection>
              <FormSection title="Frequency & Output">
                <div className="space-y-4">
                  <Select
                    label="Frequency"
                    value={FREQUENCIES.includes(draft.cronExpression) ? draft.cronExpression : "custom"}
                    options={[
                      { value: "0 0 8 * * *", label: "Daily · 08:00" },
                      { value: "0 0 8 * * MON-FRI", label: "Weekdays · 08:00" },
                      { value: "0 0 8 * * MON", label: "Weekly · Monday 08:00" },
                      { value: "0 0 8 1 * *", label: "Monthly · day 1 at 08:00" },
                      { value: "custom", label: "Custom cron" },
                    ]}
                    enableSearch={false}
                    onChange={(v) => patch({ cronExpression: v === "custom" ? "0 30 8 * * *" : String(v) })}
                  />
                  <label className="block text-sm text-slate-700">
                    Cron expression
                    <Input className={inputClass} value={draft.cronExpression} onChange={(e) => patch({ cronExpression: e.target.value })} />
                    <span className="mt-1 block text-xs text-slate-500">Server time zone. Six fields: second, minute, hour, day, month, weekday.</span>
                  </label>
                  <Select
                    label="Output format"
                    value={draft.format}
                    options={(template?.allowedFormats ?? [draft.format]).map((v) => ({ value: v, label: v }))}
                    enableSearch={false}
                    onChange={(v) => patch({ format: v as ReportFormat })}
                  />
                </div>
              </FormSection>
            </div>
            <div className="min-w-0">
              <FormSection title="Criteria & Columns">
                <div className="space-y-4">
                  {!template && <p className="text-sm text-slate-500">Choose a report template to configure its criteria and columns.</p>}
                  {template?.filterFields?.map((f) =>
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
                      <label key={f.code} className="block text-sm">
                        {f.name}
                        <Input
                          className={inputClass}
                          value={String(draft.parameters?.[f.code] ?? "")}
                          onChange={(e) => patch({ parameters: { ...draft.parameters, [f.code]: e.target.value } })}
                        />
                      </label>
                    ),
                  )}
                  <div className="space-y-3">
                    {template?.fields
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
                </div>
              </FormSection>
            </div>
            <div className="min-w-0 lg:col-span-2">
              <FormSection title={`Recipients · ${draft.recipientUserIds?.length ?? 0} selected`}>
                <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="min-w-0 space-y-3">
                    {draft.recipientUserIds?.length ? (
                      <ul className="space-y-2">
                        {draft.recipientUserIds.map((rid) => (
                          <li key={rid} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                            <span className="min-w-0 break-words">
                              {draft.recipients?.find((r) => r.id === rid)?.fullName ?? candidates.find((c) => c.id === rid)?.fullName ?? rid}
                            </span>
                            <Button size="sm" variant="outline" onClick={() => patch({ recipientUserIds: draft.recipientUserIds?.filter((uid) => uid !== rid) })}>
                              Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500">No recipient selected yet.</p>
                    )}
                  </div>
                  <div className="min-w-0 space-y-3">
                    <SearchInput value={recipientInput} onChange={setRecipientInput} placeholder="Search active authorized users…" />
                    <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
                      {candidates.map((c) => (
                        <Checkbox
                          key={c.id}
                          label={`${c.fullName} · ${c.employeeCode ?? c.email}`}
                          checked={draft.recipientUserIds?.includes(c.id) ?? false}
                          onChange={(on) =>
                            patch({
                              recipientUserIds: on ? [...(draft.recipientUserIds ?? []), c.id] : (draft.recipientUserIds ?? []).filter((rid) => rid !== c.id),
                              recipients: on
                                ? [...(draft.recipients ?? []).filter((r) => r.id !== c.id), { id: c.id, fullName: c.fullName }]
                                : draft.recipients?.filter((r) => r.id !== c.id),
                            })
                          }
                        />
                      ))}
                      {!candidates.length && <p className="text-sm text-slate-500">No eligible recipients found.</p>}
                    </div>
                  </div>
                </div>
              </FormSection>
            </div>
            {!create && (
              <div className="min-w-0 lg:col-span-2">
                <FormSection title="Change Reason">
                  <label className="block text-sm">
                    Reason <span className="text-red-600">*</span>
                    <Textarea
                      className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm"
                      rows={2}
                      maxLength={1000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                </FormSection>
              </div>
            )}
          </div>
        </fieldset>
      )}
    </div>
  );
}
