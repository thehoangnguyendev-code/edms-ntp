import React from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable } from "@/components/ui/table";
import type { BackupDetail } from "@/services/api/backupRestore";
import { formatBytes, formatDateTime } from "../../../format";
import { COMPONENT_LABEL, statusLabel } from "../../../types";
import { ReadonlyField } from "../../../components/ReadonlyField";

/** The backup the request restores: its identity, schema, integrity, where it is stored, and what it contains. */
export const BackupToRestoreTab: React.FC<{ backup?: BackupDetail }> = ({ backup }) => {
  if (!backup) return <p className="text-xs text-slate-500 lg:text-sm">The backup details could not be read.</p>;
  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <ReadonlyField label="Backup Number" value={backup.id} />
        <ReadonlyField label="Started" value={formatDateTime(backup.startedAt)} />
        <ReadonlyField label="Total size" value={formatBytes(backup.sizeBytes)} />
        <ReadonlyField label="Database schema" value={backup.schemaVersion ? `V${backup.schemaVersion}` : null} />
        <ReadonlyField
          label="Integrity"
          value={`${statusLabel(backup.verification)}${backup.verifiedAt ? ` · ${formatDateTime(backup.verifiedAt)}` : ""}`}
        />
        <ReadonlyField
          label="Stored at"
          value={backup.locations.length > 0 ? backup.locations.map((l) => `${l.target}${l.ok ? "" : " (not confirmed)"}`).join(", ") : null}
        />
      </div>
      <DataTable
        rows={backup.components}
        getRowKey={(row) => row.key}
        columns={[
          { id: "component", header: "Component", cell: (row) => COMPONENT_LABEL[row.key] ?? row.key },
          { id: "status", header: "Result", cell: (row) => <Badge color={row.status === "COMPLETED" ? "emerald" : "red"}>{statusLabel(row.status)}</Badge> },
          { id: "size", header: "Size", cell: (row) => formatBytes(row.sizeBytes) },
        ]}
      />
    </div>
  );
};
