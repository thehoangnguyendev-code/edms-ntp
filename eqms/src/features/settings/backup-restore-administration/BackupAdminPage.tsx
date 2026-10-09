import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button/Button";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import { Switch } from "@/components/ui/switch/Switch";
import { useToast } from "@/components/ui/toast/Toast";
import { backupRestoreAdministration } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { PreviewBanner } from "@/features/backup-restore/components/PreviewBanner";

/** Same row as the Controlled Copies Policy screen: label (and note) on the left, switch on the right. */
export const SwitchRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  note?: string;
}> = ({ label, checked, onChange, disabled, note }) => (
  <div className="flex items-center justify-between gap-3 py-2.5">
    <div className="min-w-0">
      <span className="text-xs sm:text-sm font-medium text-slate-900 break-words">{label}</span>
      {note && <p className="text-2xs sm:text-xs text-slate-400 mt-0.5 break-words">{note}</p>}
    </div>
    <Switch checked={checked} onChange={onChange} size="sm" disabled={disabled} />
  </div>
);

/**
 * Frame of every Backup & Restore Administration screen, laid out like the other System Administration policy screens:
 * header with Save Changes, one card with the sections inside. Saving asks for a reason.
 */
export const BackupAdminPage: React.FC<{
  title: string;
  dirty?: boolean;
  /** Screens that only list records (no editable setting) show no Save Changes. */
  readOnly?: boolean;
  children: React.ReactNode;
}> = ({ title, dirty = false, readOnly = false, children }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title={title}
        breadcrumbItems={backupRestoreAdministration(navigate, title)}
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
        description="Explain why this configuration is changing. It is recorded with your name and the time, and will need your e-signature once the backend exists."
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
