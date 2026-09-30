import React from "react";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { formatDateTime } from "@/utils/format";
import type { UncontrolledCopy } from "@/services/api/uncontrolledCopy";

const ReadOnlyField: React.FC<{
  label: string;
  value?: string | number | null;
}> = ({ label, value }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <label className="text-xs font-medium text-slate-700 sm:text-sm">
      {label}
    </label>
    <input
      readOnly
      value={value ?? "-"}
      className={CONTROL_STATE_CLASSES.readonlyField}
    />
  </div>
);

export const UncontrolledCopyInformationTab: React.FC<{
  copy: UncontrolledCopy;
}> = ({ copy }) => (
  <div className="space-y-4 md:space-y-5">
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
      <ReadOnlyField
        label="Document Number"
        value={copy.uncontrolledCopyNumber}
      />
      <ReadOnlyField label="Status" value={copy.status} />
      <ReadOnlyField
        label="Document"
        value={`${copy.documentNumber}${copy.documentTitle ? ` - ${copy.documentTitle}` : ""}`}
      />
      <ReadOnlyField
        label="Document Revision"
        value={
          [copy.documentTitle, copy.revisionNumber]
            .filter(Boolean)
            .join("_") || copy.revisionNumber
        }
      />
      <ReadOnlyField label="Reason / Purpose" value={copy.reason} />
      <ReadOnlyField
        label="Watermark applied"
        value={copy.markingApplied ? "Yes" : "Not yet generated"}
      />
      <ReadOnlyField
        label="File available"
        value={copy.fileAvailable ? "Yes" : "Not yet generated"}
      />
      <ReadOnlyField label="Downloads" value={copy.downloadCount ?? 0} />
      <ReadOnlyField
        label="Created"
        value={copy.createdAt ? formatDateTime(copy.createdAt) : "-"}
      />
      <ReadOnlyField
        label="Last Updated"
        value={copy.updatedAt ? formatDateTime(copy.updatedAt) : "-"}
      />
    </div>
    <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Uncontrolled copies are issued for reference only. They are not tracked,
      reconciled or recalled after issue and may become out of date at any time.
    </p>
  </div>
);
