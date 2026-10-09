import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Gavel, Mail, ShieldCheck, Stamp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Switch } from "@/components/ui/switch/Switch";
import { DataTable } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/Toast";
import { reportAdministration } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { PreviewBanner } from "../ReportAnalyticsPage";
import { SAMPLE_ACCESS, SAMPLE_DELIVERIES, SAMPLE_HOLDS, SAMPLE_VALIDATION } from "../sampleData";
import { IconGavel } from "@tabler/icons-react";

const SwitchRow: React.FC<{ label: string; note?: string; checked: boolean; onChange: (value: boolean) => void }> = ({ label, note, checked, onChange }) => (
  <div className="flex items-center justify-between gap-3 py-2.5">
    <div className="min-w-0">
      <span className="text-xs sm:text-sm font-medium text-slate-900 break-words">{label}</span>
      {note && <p className="text-2xs sm:text-xs text-slate-400 mt-0.5 break-words">{note}</p>}
    </div>
    <Switch checked={checked} onChange={onChange} size="sm" />
  </div>
);

/** Frame of every Report Administration screen: header with Save Changes (asks for a reason), one card with the sections. */
const ReportAdminPage: React.FC<{ title: string; dirty?: boolean; readOnly?: boolean; children: React.ReactNode }> = ({ title, dirty = false, readOnly = false, children }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title={title}
        breadcrumbItems={reportAdministration(navigate, title)}
        actions={
          readOnly ? undefined : (
            <Button size="sm" variant="outline-emerald" onClick={() => setSaving(true)} disabled={!dirty} className="gap-2 whitespace-nowrap">
              Save Changes
            </Button>
          )
        }
      />
      <PreviewBanner />
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 space-y-4">{children}</div>
      </div>
      <FormModal
        isOpen={saving}
        onClose={() => setSaving(false)}
        title={`Save ${title}`}
        description="Explain why this configuration is changing. It is recorded with your name and the time."
        confirmText="Save"
        confirmDisabled={!reason.trim()}
        onConfirm={() => {
          setSaving(false);
          setReason("");
          showToast({ type: "info", title: "Save Changes", message: "Design preview: nothing was sent to a server." });
        }}
      >
        <FormField label="Reason for change" required>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormField>
      </FormModal>
    </div>
  );
};

const Yes: React.FC<{ on: boolean }> = ({ on }) => (
  <Badge color={on ? "emerald" : "slate"} size="sm">
    {on ? "Yes" : "No"}
  </Badge>
);

export const ReportAccessScopeView: React.FC = () => (
  <ReportAdminPage title="Report Access & Data Scope" readOnly>
    <FormSection title="Role Matrix" icon={<Users className="h-4 w-4" />} description="What each role can do with reports and how far its data reaches. Roles and permissions are still edited in Roles & Permissions.">
      <DataTable
        rows={SAMPLE_ACCESS}
        getRowKey={(row) => row.role}
        columns={[
          { id: "role", header: "Role", cell: (row) => <span className="font-medium text-slate-900">{row.role}</span> },
          { id: "library", header: "Reports in library", cell: (row) => row.library },
          { id: "runOwn", header: "Run", cell: (row) => <Yes on={row.runOwn} /> },
          { id: "viewAll", header: "See everyone's runs", cell: (row) => <Yes on={row.viewAll} /> },
          { id: "download", header: "Download", cell: (row) => <Yes on={row.download} /> },
          { id: "schedule", header: "Schedule", cell: (row) => <Yes on={row.schedule} /> },
          { id: "scope", header: "Data scope", cell: (row) => row.scope },
        ]}
      />
    </FormSection>
  </ReportAdminPage>
);

export const ReportOutputControlsView: React.FC = () => {
  const [state, setState] = useState({ footer: true, watermark: true, sizeCap: "25", hashOnPage: true });
  const [dirty, setDirty] = useState(false);
  const set = <K extends keyof typeof state>(key: K, value: (typeof state)[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  return (
    <ReportAdminPage title="Report Output Controls" dirty={dirty}>
      <FormSection title="Every Output File" icon={<Stamp className="h-4 w-4" />} description="Applies to every report file, so a printout can be traced back to its run.">
        <SwitchRow label="Controlled footer" note="Run ID, definition version, data as-of time, who ran it and page number." checked={state.footer} onChange={(v) => set("footer", v)} />
        <SwitchRow label="Show the checksum on the last page" note="Lets a reader compare a printout with the stored file." checked={state.hashOnPage} onChange={(v) => set("hashOnPage", v)} />
        <SwitchRow label="Watermark informational reports and previews" note="Marks them as not a GMP record." checked={state.watermark} onChange={(v) => set("watermark", v)} />
        <div className="max-w-xs pt-2">
          <label className="mb-1.5 block text-xs sm:text-sm font-medium text-slate-700">Largest output file (MB)</label>
          <Input type="number" min={1} value={state.sizeCap} onChange={(event) => set("sizeCap", event.target.value)} />
        </div>
      </FormSection>
    </ReportAdminPage>
  );
};

export const ReportRetentionView: React.FC = () => {
  const { showToast } = useToast();
  return (
    <ReportAdminPage title="Report Retention & Legal Hold" readOnly>
      <FormSection title="Retention" icon={<Clock className="h-4 w-4" />} description="How long an output file is kept. The run record itself stays after the file expires. No period has been approved in the Decision Log, so none is shown.">
        <p className="text-xs text-slate-500">Retention is set per report definition once QA approves a period.</p>
      </FormSection>
      <FormSection
        title="Legal Hold Register"
        icon={<IconGavel className="h-4 w-4" />}
        description="Files that will not be purged until the hold is released."
        headerRight={
          <Button size="sm" variant="default" onClick={() => showToast({ type: "info", title: "Legal hold", message: "Design preview: nothing was sent to a server." })}>
            Place Hold
          </Button>
        }
      >
        <DataTable
          rows={SAMPLE_HOLDS}
          getRowKey={(row) => row.runId}
          columns={[
            { id: "run", header: "Run", cell: (row) => <span className="font-medium text-slate-900">{row.runId}</span> },
            { id: "report", header: "Report", cell: (row) => row.report },
            { id: "by", header: "Applied by", cell: (row) => row.appliedBy },
            { id: "at", header: "Applied", cell: (row) => row.appliedAt },
            { id: "reason", header: "Reason", cell: (row) => <span className="block max-w-96 whitespace-normal">{row.reason}</span> },
          ]}
        />
      </FormSection>
    </ReportAdminPage>
  );
};

export const ReportDeliveryView: React.FC = () => {
  const [maxRecipients, setMaxRecipients] = useState("20");
  const [dirty, setDirty] = useState(false);
  return (
    <ReportAdminPage title="Scheduled Report Delivery" dirty={dirty}>
      <FormSection title="Recipients" icon={<Mail className="h-4 w-4" />} description="Rules for who a scheduled report can be sent to.">
        <div className="max-w-xs">
          <label className="mb-1.5 block text-xs sm:text-sm font-medium text-slate-700">Most recipients per schedule</label>
          <Input
            type="number"
            min={1}
            value={maxRecipients}
            onChange={(event) => {
              setMaxRecipients(event.target.value);
              setDirty(true);
            }}
          />
        </div>
      </FormSection>
      <FormSection title="Delivery Log" icon={<Mail className="h-4 w-4" />} description="Every attempt to send a scheduled report, including the ones that failed.">
        <DataTable
          rows={SAMPLE_DELIVERIES}
          getRowKey={(row) => row.id}
          columns={[
            { id: "schedule", header: "Schedule", cell: (row) => <span className="font-medium text-slate-900">{row.schedule}</span> },
            { id: "at", header: "Attempted", cell: (row) => row.at },
            { id: "recipients", header: "Recipients", cell: (row) => row.recipients },
            {
              id: "status",
              header: "Result",
              cell: (row) => (
                <Badge color={row.status === "SENT" ? "emerald" : "red"} size="sm">
                  {row.status === "SENT" ? "Sent" : "Failed"}
                </Badge>
              ),
            },
            { id: "detail", header: "Detail", cell: (row) => row.detail },
          ]}
        />
      </FormSection>
    </ReportAdminPage>
  );
};

const VALIDATION_LABEL = { VALIDATED: "Validated", PENDING: "Pending", NOT_REQUIRED: "Not required" } as const;
const VALIDATION_COLOR = { VALIDATED: "emerald", PENDING: "amber", NOT_REQUIRED: "slate" } as const;

export const ReportValidationView: React.FC = () => (
  <ReportAdminPage title="Report Change History & Validation" readOnly>
    <FormSection title="Validation Status" icon={<ShieldCheck className="h-4 w-4" />} description="An Official report is expected to be validated before it can be run. Each definition change creates a new version with a reason; open a definition in Report Definitions to see its history.">
      <DataTable
        rows={SAMPLE_VALIDATION}
        getRowKey={(row) => row.report}
        columns={[
          { id: "report", header: "Report", cell: (row) => <span className="font-medium text-slate-900">{row.report}</span> },
          { id: "class", header: "Classification", cell: (row) => row.classification },
          { id: "version", header: "Definition version", cell: (row) => row.version },
          {
            id: "status",
            header: "Validation",
            cell: (row) => (
              <Badge color={VALIDATION_COLOR[row.status]} size="sm">
                {VALIDATION_LABEL[row.status]}
              </Badge>
            ),
          },
        ]}
      />
    </FormSection>
  </ReportAdminPage>
);
