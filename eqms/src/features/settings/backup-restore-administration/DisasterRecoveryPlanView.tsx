import React, { useState } from "react";
import { CircleStar, ClipboardList, Package, Siren } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form/FormSection";
import { Input } from "@/components/ui/form/ResponsiveForm";
import { DataTable } from "@/components/ui/table";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { SAMPLE_OVERVIEW, SAMPLE_REBUILD_KIT, SAMPLE_DR_SCENARIOS } from "@/features/backup-restore/sampleData";
import { formatDate } from "@/features/backup-restore/format";
import { statusLabel, type DrScenario, type RebuildKitItem } from "@/features/backup-restore/types";
import { BackupAdminPage } from "./BackupAdminPage";

const KIT_COLOR: Record<RebuildKitItem["state"], "emerald" | "amber" | "red"> = { CURRENT: "emerald", STALE: "amber", MISSING: "red" };

export const DisasterRecoveryPlanView: React.FC = () => {
  const [scenarios, setScenarios] = useState<DrScenario[]>(SAMPLE_DR_SCENARIOS);
  const [drillDays, setDrillDays] = useState(String(SAMPLE_OVERVIEW.drDrillIntervalDays));
  const [authority, setAuthority] = useState("Head of QA and Head of IT");
  const [dirty, setDirty] = useState(false);
  const missing = SAMPLE_REBUILD_KIT.filter((item) => item.state !== "CURRENT");

  const patch = (code: string, change: Partial<DrScenario>) => {
    setScenarios((prev) => prev.map((s) => (s.code === code ? { ...s, ...change } : s)));
    setDirty(true);
  };
  const hours = (value: number, onChange: (next: number) => void) => (
    <Input type="number" min={1} className="w-24" value={value} onChange={(event) => onChange(Number(event.target.value))} />
  );

  return (
    <BackupAdminPage title="Disaster Recovery Plan" dirty={dirty}>
      {missing.length > 0 && (
        <WarningBanner
          variant="warning"
          title="The rebuild kit is not complete"
          description={`${missing.length} item(s) are missing or out of date. Without them a rebuild cannot be relied on.`}
        />
      )}

      <FormSection
        title="Recovery Targets"
        icon={<Siren className="h-4 w-4" />}
        description="RPO is the most data, in hours, that may be lost; RTO is the longest time, in hours, to be working again. Set them by risk to the quality system."
      >
        <DataTable
          rows={scenarios}
          getRowKey={(row) => row.code}
          columns={[
            {
              id: "scenario",
              header: "Scenario",
              cell: (row) => (
                <div className="max-w-96 whitespace-normal">
                  <span className="font-medium text-slate-900">{row.label}</span>
                  <span className="block text-xs text-slate-500">{row.description}</span>
                </div>
              ),
            },
            { id: "rpo", header: "RPO (hours)", cell: (row) => hours(row.rpoHours, (rpoHours) => patch(row.code, { rpoHours })) },
            { id: "rto", header: "RTO (hours)", cell: (row) => hours(row.rtoHours, (rtoHours) => patch(row.code, { rtoHours })) },
          ]}
        />
        <p className="mt-3 text-2xs sm:text-xs text-slate-400">A recovery point under 24 hours needs the database change log to be archived, which is not enabled yet.</p>
      </FormSection>

      <FormSection title="Rebuild Kit" icon={<Package className="h-4 w-4" />} description="Everything needed to rebuild the system on empty hardware without the old server or the internet.">
        <DataTable
          rows={SAMPLE_REBUILD_KIT}
          getRowKey={(row) => row.code}
          columns={[
            {
              id: "item",
              header: "Item",
              cell: (row) => (
                <div className="max-w-96 whitespace-normal">
                  <span className="font-medium text-slate-900">{row.label}</span>
                  <span className="block text-xs text-slate-500">{row.detail}</span>
                </div>
              ),
            },
            { id: "state", header: "State", cell: (row) => <Badge color={KIT_COLOR[row.state]}>{statusLabel(row.state)}</Badge> },
            { id: "verified", header: "Last verified", cell: (row) => formatDate(row.lastVerifiedAt) },
          ]}
        />
      </FormSection>

      <FormSection title="Declaration and Drills" icon={<CircleStar className="h-4 w-4" />}>
        <div className="divide-y divide-slate-100 -my-2">
          <div className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-medium text-slate-900">Who may declare a disaster</span>
              <p className="text-2xs sm:text-xs text-slate-400 mt-0.5">A declaration opens the incident record every recovery request must reference.</p>
            </div>
            <Input
              className="w-72"
              value={authority}
              onChange={(event) => {
                setAuthority(event.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-medium text-slate-900">Run a disaster recovery drill every (days)</span>
              <p className="text-2xs sm:text-xs text-slate-400 mt-0.5">Results are recorded under Disaster Recovery Drills.</p>
            </div>
            <Input
              type="number"
              min={1}
              className="w-24"
              value={drillDays}
              onChange={(event) => {
                setDrillDays(event.target.value);
                setDirty(true);
              }}
            />
          </div>
        </div>
      </FormSection>
    </BackupAdminPage>
  );
};
