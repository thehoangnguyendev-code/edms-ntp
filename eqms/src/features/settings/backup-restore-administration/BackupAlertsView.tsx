import React, { useState } from "react";
import { Bell, Mail } from "lucide-react";
import { FormSection } from "@/components/ui/form/FormSection";
import { Input } from "@/components/ui/form/ResponsiveForm";
import { DataTable } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch/Switch";
import { SAMPLE_ALERT_RULES } from "@/features/backup-restore/sampleData";
import type { AlertRule } from "@/features/backup-restore/types";
import { BackupAdminPage } from "./BackupAdminPage";
import { IconSpeakerphone } from "@tabler/icons-react";

export const BackupAlertsView: React.FC = () => {
  const [rules, setRules] = useState<AlertRule[]>(SAMPLE_ALERT_RULES);
  const [recipients, setRecipients] = useState("qa-admin@example.com");
  const [dirty, setDirty] = useState(false);
  const patch = (event: string, change: Partial<AlertRule>) => {
    setRules((prev) => prev.map((r) => (r.event === event ? { ...r, ...change } : r)));
    setDirty(true);
  };

  return (
    <BackupAdminPage title="Backup Alerts & Recipients" dirty={dirty}>
      <FormSection title="Recipients" icon={<Mail className="h-4 w-4" />} description="Problems also show on the Backup Status Overview whether or not an alert is sent.">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-medium text-slate-900">Send alert e-mails to</span>
            <p className="text-2xs sm:text-xs text-slate-400 mt-0.5">Separate several addresses with a comma.</p>
          </div>
          <Input
            className="w-72"
            value={recipients}
            onChange={(event) => {
              setRecipients(event.target.value);
              setDirty(true);
            }}
          />
        </div>
      </FormSection>
      <FormSection title="Events" icon={<IconSpeakerphone className="h-4 w-4" />}>
        <DataTable
          rows={rules}
          getRowKey={(row) => row.event}
          columns={[
            {
              id: "event",
              header: "When",
              cell: (row) => (
                <div className="max-w-96 whitespace-normal">
                  <span className="font-medium text-slate-900">{row.label}</span>
                  <span className="block text-xs text-slate-500">{row.hint}</span>
                </div>
              ),
            },
            {
              id: "threshold",
              header: "Threshold",
              cell: (row) =>
                row.threshold ? (
                  <span className="inline-flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      className="w-24"
                      value={row.threshold.value}
                      onChange={(event) => patch(row.event, { threshold: { unit: row.threshold!.unit, value: Number(event.target.value) } })}
                    />
                    <span className="text-xs text-slate-500">{row.threshold.unit}</span>
                  </span>
                ) : (
                  "—"
                ),
            },
            { id: "email", header: "E-mail", cell: (row) => <Switch size="sm" checked={row.email} onChange={(email) => patch(row.event, { email })} /> },
            { id: "inapp", header: "In-app", cell: (row) => <Switch size="sm" checked={row.inApp} onChange={(inApp) => patch(row.event, { inApp })} /> },
          ]}
        />
      </FormSection>
    </BackupAdminPage>
  );
};
