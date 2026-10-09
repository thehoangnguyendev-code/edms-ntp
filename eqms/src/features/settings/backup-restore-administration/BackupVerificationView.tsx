import React, { useState } from "react";
import { DatabaseBackup, DatabaseCheck, ListChecks, RefreshCcw, ShieldCheck } from "lucide-react";
import { FormSection } from "@/components/ui/form/FormSection";
import { Input } from "@/components/ui/form/ResponsiveForm";
import { SAMPLE_OVERVIEW, SAMPLE_VERIFICATION_CHECKS } from "@/features/backup-restore/sampleData";
import { BackupAdminPage, SwitchRow } from "./BackupAdminPage";
import { IconChecks } from "@tabler/icons-react";

const NumberRow: React.FC<{ label: string; note: string; value: string; onChange: (value: string) => void }> = ({ label, note, value, onChange }) => (
  <div className="flex items-center justify-between gap-3 py-2.5">
    <div className="min-w-0">
      <span className="text-xs sm:text-sm font-medium text-slate-900">{label}</span>
      <p className="text-2xs sm:text-xs text-slate-400 mt-0.5">{note}</p>
    </div>
    <Input type="number" min={1} className="w-24" value={value} onChange={(event) => onChange(event.target.value)} />
  </div>
);

export const BackupVerificationView: React.FC = () => {
  const [verifyAfter, setVerifyAfter] = useState(true);
  const [drillDays, setDrillDays] = useState(String(SAMPLE_OVERVIEW.drillIntervalDays));
  const [sampleSize, setSampleSize] = useState("20");
  const [checks, setChecks] = useState(SAMPLE_VERIFICATION_CHECKS);
  const [dirty, setDirty] = useState(false);
  const touch = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setDirty(true);
  };

  return (
    <BackupAdminPage title="Backup Verification & Restore Drills" dirty={dirty}>
      <FormSection title="Integrity Verification" icon={<DatabaseCheck className="h-4 w-4" />} description="A backup that has never been restored is not proven.">
        <div className="divide-y divide-slate-100 -my-2">
          <SwitchRow label="Verify every backup after it is written" note="Re-reads the backup and compares its checksums." checked={verifyAfter} onChange={touch(setVerifyAfter)} />
        </div>
      </FormSection>

      <FormSection title="Restore Drills" icon={<RefreshCcw className="h-4 w-4" />} description="A drill restores into the validation environment and runs the checks below. Disaster recovery drills are set in the Disaster Recovery Plan.">
        <div className="divide-y divide-slate-100 -my-2">
          <NumberRow label="Run a drill every (days)" note="The Backup Status Overview warns when a drill is overdue." value={drillDays} onChange={touch(setDrillDays)} />
          <NumberRow label="Documents sampled per drill" note="Opened end to end after the restore." value={sampleSize} onChange={touch(setSampleSize)} />
        </div>
      </FormSection>

      <FormSection title="Post-Restore Checks" icon={<ListChecks className="h-4 w-4" />} description="Run after every restore. A required check that fails marks the restore as failed.">
        <div className="divide-y divide-slate-100 -my-2">
          {checks.map((check) => (
            <SwitchRow
              key={check.code}
              label={check.label}
              note={`${check.hint} Required.`}
              checked={check.required}
              onChange={(required) => {
                setChecks((prev) => prev.map((c) => (c.code === check.code ? { ...c, required } : c)));
                setDirty(true);
              }}
            />
          ))}
        </div>
      </FormSection>
    </BackupAdminPage>
  );
};
