import React from "react";
import { DataTable } from "@/components/ui/table";
import type { RestoreRequestRecord } from "@/services/api/backupRestore";
import { formatBytes, formatDateTime } from "../../../format";
import { COMPONENT_LABEL } from "../../../types";
import { ReadonlyField } from "../../../components/ReadonlyField";

/** What the restore would put back, measured from the backup and from the live database (measured again at approval). */
export const ImpactTab: React.FC<{ request: RestoreRequestRecord }> = ({ request }) => {
  const impact = request.impact;
  if (!impact) return <p className="text-xs text-slate-500 lg:text-sm">No impact report is recorded for this request.</p>;
  const live = impact.liveRowsAfterBackup;
  return (
    <div className="space-y-4 md:space-y-5">
      <p className="text-xs text-slate-500">Measured {formatDateTime(impact.measuredAt)} by {impact.measuredBy}; measured again when approved.</p>
      <DataTable
        rows={impact.components}
        getRowKey={(row) => row.key}
        columns={[
          { id: "component", header: "Component", cell: (row) => COMPONENT_LABEL[row.key] ?? row.key },
          { id: "size", header: "Size", cell: (row) => formatBytes(row.sizeBytes) },
          { id: "objects", header: "Documents", cell: (row) => row.objectCount ?? "—" },
          { id: "rows", header: "Rows", cell: (row) => row.rows ?? "—" },
        ]}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <ReadonlyField label="Rows in the backup" value={impact.rowsInBackup.toLocaleString()} />
        <ReadonlyField
          label="Audit rows lost"
          value={live?.measured ? (live.auditRows ?? 0).toLocaleString() : `Not measured: ${live?.reason ?? "unknown"}`}
        />
        <ReadonlyField label="Copies" value={impact.targets.map((t) => `${t.target}${t.ok ? "" : " (not confirmed)"}`).join(", ") || null} />
      </div>
    </div>
  );
};
