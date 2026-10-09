import React, { useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { RestoreDetailDrawer } from "../components/RestoreDetailDrawer";
import { SAMPLE_RESTORES } from "../sampleData";
import { type RestoreRequest } from "../types";
import { formatDateTime } from "../format";

const count = (request: RestoreRequest, result: "PASS" | "FAIL" | "WARNING") => request.verification?.filter((check) => check.result === result).length ?? 0;

/** What the automatic checks found after each restore: schema, row counts, files against records. */
export const RestoreVerificationReportsView: React.FC = () => {
  const drag = useTableDragScroll();
  const [selected, setSelected] = useState<RestoreRequest>();
  const rows = SAMPLE_RESTORES.filter((request) => request.verification && request.verification.length > 0);

  return (
    <BackupRestorePage title="Restore Verification Reports" group="Restore">
      <WarningBanner variant="info" description="A restore is only complete when every required check has passed. Open a row to see each check and its detail." />
      <div className="flex min-w-0 w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-1 flex-col p-4 md:p-5">
          <DataTable
            rows={rows}
            getRowKey={(row) => row.id}
            emptyState={<TableEmptyState title="No Verification Reports" description="Reports appear after a restore has been verified." />}
            scrollerRef={drag.scrollerRef}
            scrollProps={drag.dragEvents}
            isDragging={drag.isDragging}
            columns={[
              { id: "no", header: "No.", cell: (_row, index) => index + 1 },
              {
                id: "id",
                header: "Restore request",
                cell: (row) => (
                  <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => setSelected(row)}>
                    {row.id}
                  </button>
                ),
              },
              { id: "backup", header: "Backup", cell: (row) => row.backupId },
              { id: "pass", header: "Passed", cell: (row) => <Badge color="emerald">{count(row, "PASS")}</Badge> },
              { id: "warning", header: "Warnings", cell: (row) => <Badge color={count(row, "WARNING") ? "amber" : "slate"}>{count(row, "WARNING")}</Badge> },
              { id: "fail", header: "Failed", cell: (row) => <Badge color={count(row, "FAIL") ? "red" : "slate"}>{count(row, "FAIL")}</Badge> },
              { id: "at", header: "Completed", cell: (row) => formatDateTime(row.completedAt) },
            ]}
          />
        </div>
      </div>
      <RestoreDetailDrawer request={selected} onClose={() => setSelected(undefined)} onDecision={() => undefined} />
    </BackupRestorePage>
  );
};
