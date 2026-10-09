import React, { useState } from "react";
import { Play, Target, UserCheck } from "lucide-react";
import { FormSection } from "@/components/ui/form/FormSection";
import { Input } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { BackupAdminPage, SwitchRow } from "./BackupAdminPage";
import { IconTargetArrow, IconUserCheck } from "@tabler/icons-react";

export const RestoreControlsView: React.FC = () => {
  const [allowProduction, setAllowProduction] = useState(true);
  const [changeControl, setChangeControl] = useState(true);
  const [safetyBackup, setSafetyBackup] = useState(true);
  const [approver, setApprover] = useState("PERMISSION");
  const [maintenance, setMaintenance] = useState("120");
  const [dirty, setDirty] = useState(false);
  const touch = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setDirty(true);
  };

  return (
    <BackupAdminPage title="Restore Approval & Execution Rules" dirty={dirty}>
      <FormSection title="Targets" icon={<IconTargetArrow className="h-4 w-4" />} description="The server checks these rules when a restore is requested, approved and run.">
        <div className="divide-y divide-slate-100 -my-2">
          <SwitchRow label="Allow restore into production" note="When off, restores are only possible into the validation environment." checked={allowProduction} onChange={touch(setAllowProduction)} />
          <SwitchRow label="Require an approved change control reference" note="Applies to production restores." checked={changeControl} onChange={touch(setChangeControl)} />
        </div>
        {!allowProduction && (
          <WarningBanner className="mt-4" variant="info" description="With production restore off, recovering from data loss first needs this switched on, which is itself recorded." />
        )}
      </FormSection>

      <FormSection title="Approval" icon={<IconUserCheck className="h-4 w-4" />} description="A restore is never approved by the person who requested it.">
        <div className="divide-y divide-slate-100 -my-2">
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-xs sm:text-sm font-medium text-slate-900">Who can approve</span>
            <Select
              className="w-72"
              value={approver}
              onChange={touch(setApprover)}
              options={[
                { label: "Anyone with the approve-restore permission", value: "PERMISSION" },
                { label: "A named approver group", value: "GROUP" },
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-xs sm:text-sm font-medium text-slate-900">Approvals needed</span>
            <Input className="w-72" value="1 (second person)" disabled />
          </div>
        </div>
      </FormSection>

      <FormSection title="Execution" icon={<Play className="h-4 w-4" />}>
        <div className="divide-y divide-slate-100 -my-2">
          <SwitchRow label="Safety backup just before a production restore" note="So the restore itself can be undone." checked={safetyBackup} onChange={touch(setSafetyBackup)} />
          <div className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-medium text-slate-900">Longest maintenance window (minutes)</span>
              <p className="text-2xs sm:text-xs text-slate-400 mt-0.5">The restore is stopped and flagged if it overruns.</p>
            </div>
            <Input type="number" min={15} className="w-24" value={maintenance} onChange={(event) => touch(setMaintenance)(event.target.value)} />
          </div>
        </div>
        {!safetyBackup && <WarningBanner className="mt-4" variant="warning" description="Without a safety backup, a bad restore cannot be reversed." />}
      </FormSection>
    </BackupAdminPage>
  );
};
