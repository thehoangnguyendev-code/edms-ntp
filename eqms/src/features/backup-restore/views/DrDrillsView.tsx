import React from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { DataTable } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { useToast } from "@/components/ui/toast/Toast";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { SAMPLE_DR_DRILLS, SAMPLE_DR_SCENARIOS } from "../sampleData";
import { statusLabel, type DrDrillResult } from "../types";
import { formatDateTime } from "../format";

const RESULT_COLOR: Record<DrDrillResult, "emerald" | "amber" | "red"> = {
  PASSED: "emerald",
  PASSED_WITH_FINDINGS: "amber",
  FAILED: "red",
};

export const DrDrillsView: React.FC = () => {
  const { showToast } = useToast();
  const drag = useTableDragScroll();
  const scenarioLabel = (code: string) => SAMPLE_DR_SCENARIOS.find((s) => s.code === code)?.label ?? statusLabel(code);

  return (
    <BackupRestorePage
      title="Disaster Recovery Drills"
      group="Restore"
      actions={
        <Button
          size="sm"
          className="gap-2 whitespace-nowrap"
          onClick={() => showToast({ type: "info", title: "Record disaster recovery drill", message: "Design preview: nothing was sent to a server." })}
        >
          <Plus className="h-4 w-4" />
          Record Disaster Recovery Drill
        </Button>
      }
    >
      <WarningBanner
        variant="info"
        title="What a disaster recovery drill proves"
        description="The system is rebuilt on empty hardware from the off-site copy and the rebuild kit, and the time taken is compared with the recovery time target set in the Disaster Recovery Plan."
      />
      <div className="flex min-w-0 w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-1 flex-col p-4 md:p-5">
          <DataTable
            rows={SAMPLE_DR_DRILLS}
            getRowKey={(d) => d.id}
            emptyState={<TableEmptyState title="No Disaster Recovery Drills" description="Disaster recovery drills will appear here." />}
            scrollerRef={drag.scrollerRef}
            scrollProps={drag.dragEvents}
            isDragging={drag.isDragging}
            columns={[
              { id: "no", header: "No.", cell: (_d, i) => i + 1 },
              {
                id: "id",
                header: "Drill",
                cell: (d) => (
                  <div>
                    <span className="font-medium text-slate-900">{d.id}</span>
                    <span className="block text-xs text-slate-500">{scenarioLabel(d.scenario)}</span>
                  </div>
                ),
              },
              { id: "at", header: "Performed", cell: (d) => formatDateTime(d.performedAt) },
              { id: "lead", header: "Led by", cell: (d) => d.lead },
              {
                id: "rto",
                header: "Recovery time",
                cell: (d) => (
                  <span className={d.achievedRtoHours > d.targetRtoHours ? "font-medium text-red-700" : undefined}>
                    {d.achievedRtoHours} h <span className="text-xs text-slate-500">/ target {d.targetRtoHours} h</span>
                  </span>
                ),
              },
              { id: "result", header: "Result", cell: (d) => <Badge color={RESULT_COLOR[d.result]}>{statusLabel(d.result)}</Badge> },
              { id: "findings", header: "Findings", cell: (d) => <span className="block max-w-96 whitespace-normal">{d.findings}</span> },
            ]}
          />
        </div>
      </div>
    </BackupRestorePage>
  );
};
