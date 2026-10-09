import React from "react";
import { Clock, Gavel } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { BackupAdminLivePage } from "./BackupAdminLivePage";

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0 lg:flex-row lg:items-center lg:gap-2">
    <label className="w-full flex-shrink-0 text-xs font-medium text-slate-700 sm:text-sm lg:w-44">{label}</label>
    <div className="min-w-0 flex-1 break-words text-xs text-slate-900 lg:text-sm">{children}</div>
  </div>
);

/**
 * Backup Retention & Legal Hold. The retention rule is a decision (BR-2), not a setting: backups are kept permanently and nothing
 * deletes one by age. This screen states it; it has nothing to edit. Legal hold is not built yet and says so.
 */
export const BackupRetentionView: React.FC = () => (
  <BackupAdminLivePage title="Backup Retention & Legal Hold">
    <FormSection title="Retention" icon={<Clock className="h-4 w-4" />} description="Fixed by a recorded decision. It cannot be changed from here.">
      <div className="space-y-3 lg:space-y-4">
        <Fact label="How long backups are kept">
          <Badge color="emerald">Permanently</Badge>
        </Fact>
        <Fact label="Removed by age?">No. No job deletes a backup because of its age, and the backup policy cannot set a shorter period.</Fact>
        <Fact label="What this costs">Storage only grows. Targets must be expanded before they fill; the forecast belongs to the yearly review.</Fact>
        <Fact label="Physical media">A medium is retired only with a destruction record, and never while it holds data under legal hold.</Fact>
      </div>
    </FormSection>

    <FormSection title="Legal Hold" icon={<Gavel className="h-4 w-4" />} description="Marks backups connected to an investigation so the media holding them cannot be destroyed.">
      <WarningBanner
        variant="info"
        title="Legal hold is not available yet"
        description="Applying and releasing a hold, with a second person for the release, is planned but not built. Until then no backup can be marked, and the Offline Media Register can only record that a medium holds held data when that is set directly in the register."
      />
    </FormSection>
  </BackupAdminLivePage>
);
