import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock, DatabaseCheck, Gavel, ListChecks, Play, RefreshCcw, Target, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form/FormSection";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { usePermissions } from "@/hooks/usePermissions";
import { Fact } from "@/features/backup-restore/components/Fact";
import { backupRestoreApi, type RestoreRuleRecord } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupAdminLivePage } from "./BackupAdminLivePage";

const DRILL_RULE = "RESTORE_DRILL_INTERVAL_DAYS";

/**
 * The controls of a restore. They are part of the procedure and are enforced by the server, so they are shown here as fixed facts and
 * cannot be switched off. The values that may be set (the validity of a test restore) are in the Restore Approval & Execution Rules
 * screen under Backup & Restore.
 */
const RestoreRulesPanel: React.FC = () => (
  <div className="space-y-6">
    <FormSection title="Targets" icon={<Target className="h-4 w-4" />} description="The server checks these when a restore is requested, approved and run.">
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>A restore goes to the validation environment or to production.</li>
        <li>A production restore needs a passed test restore of the same backup, within the validity set in the rules.</li>
        <li>A change control reference can be given with a request; it is kept with the request.</li>
      </ul>
    </FormSection>

    <FormSection title="Approval" icon={<UserCheck className="h-4 w-4" />} description="A restore is never approved by the person who requested it.">
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>The person who requested a restore cannot approve it.</li>
        <li>Approving and rejecting need an electronic signature, recorded with the decision.</li>
        <li>Exactly one approval is needed: a second person.</li>
      </ul>
    </FormSection>

    <FormSection title="Execution" icon={<Play className="h-4 w-4" />}>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>The person who approved a restore cannot schedule it.</li>
        <li>The maintenance window is entered by a person with the restore execution permission; the system is locked while the restore runs.</li>
      </ul>
      <WarningBanner variant="info" description="The restore itself (replacing the database) is not run from this screen yet. A safety backup before a production restore is not yet part of the run." />
    </FormSection>
  </div>
);

/**
 * How backups are verified and drilled. The checks are part of the procedure, not settings: they run in the agent and a required check
 * cannot be switched off. The one value that may be changed is the restore drill interval, a rule with a recorded, signed change.
 */
const VerificationPanel: React.FC = () => {
  const [rule, setRule] = useState<RestoreRuleRecord>();
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .restoreRules()
      .then((rules) => {
        if (live) setRule(rules.find((r) => r.code === DRILL_RULE));
      })
      .catch((e) => {
        if (live) setError(getApiErrorMessage(e, "The drill interval could not be loaded."));
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {error && <WarningBanner variant="error" title="Unable to load" description={error} />}
      <FormSection title="Integrity Verification" icon={<DatabaseCheck className="h-4 w-4" />} description="A backup that has never been restored is not proven.">
        <p className="text-sm text-slate-700">Every backup is verified after it is written: the checksums of the stored files are compared with the manifest, which is signed.</p>
      </FormSection>

      <FormSection title="Restore Drills" icon={<RefreshCcw className="h-4 w-4" />} description="A drill restores a backup into a separate database and runs the post-restore checks.">
        <Fact label="Run a restore drill every (days)">
          <span className="text-lg font-semibold text-slate-900">{rule ? rule.value : "—"}</span>
          <span className="mt-1 block text-xs font-normal text-slate-500">Changed in the Restore Approval &amp; Execution Rules screen under Backup &amp; Restore, with an electronic signature.</span>
        </Fact>
      </FormSection>

      <FormSection title="Post-Restore Checks" icon={<ListChecks className="h-4 w-4" />} description="Run after every restore. A required check that fails marks the restore as failed.">
        <p className="text-sm text-slate-700">The checks are fixed in the procedure: schema version, row counts, foreign keys, audit trail, stored documents against their recorded checksums, signatures, accounts, schedules and jobs. Required checks cannot be switched off.</p>
      </FormSection>
    </div>
  );
};

/** The retention rule is a decision (BR-2), not a setting: backups are kept permanently and nothing deletes one by age. */
const RetentionPanel: React.FC = () => (
  <div className="space-y-6">
    <FormSection title="Retention" icon={<Clock className="h-4 w-4" />} description="Fixed by a recorded decision. It cannot be changed from here.">
      <div className="space-y-3">
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
  </div>
);

/** The tabs of the screen. Each one shows only to a person who may view it; the permission is the one that view already used. */
const CONTROL_TABS: { id: string; label: string; permission: string; render: () => React.ReactNode }[] = [
  { id: "restore-rules", label: "Restore Rules", permission: "backup.admin.restore_controls.view", render: () => <RestoreRulesPanel /> },
  { id: "verification", label: "Verification & Drills", permission: "backup.admin.verification.view", render: () => <VerificationPanel /> },
  { id: "retention", label: "Retention & Legal Hold", permission: "backup.admin.retention.view", render: () => <RetentionPanel /> },
];

/**
 * Backup Controls: how a restore is approved and run, how backups are verified and drilled, and how long they are kept. One screen with
 * a tab for each part, laid out like the tabs of the document detail; the tab is kept in the address (?tab=) so a link opens the right one.
 */
export const BackupControlsView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermissions();

  const visible = CONTROL_TABS.filter((tab) => hasPermission(tab.permission));
  const requested = searchParams.get("tab");
  const active = visible.find((tab) => tab.id === requested) ?? visible[0];
  const tabs: TabItem[] = visible.map((tab) => ({ id: tab.id, label: tab.label }));

  return (
    <BackupAdminLivePage title="Backup Controls">
      {!active ? (
        <WarningBanner variant="info" description="You do not have permission to view any of these controls." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <TabNav tabs={tabs} activeTab={active.id} onChange={(id) => setSearchParams({ tab: id }, { replace: true })} layoutId="backup-controls-tab" ariaLabel="Backup controls" />
          <div className="p-4 md:p-5">{active.render()}</div>
        </div>
      )}
    </BackupAdminLivePage>
  );
};
