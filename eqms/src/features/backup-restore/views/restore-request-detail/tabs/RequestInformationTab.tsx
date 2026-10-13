import React from "react";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import type { RestoreRequestRecord } from "@/services/api/backupRestore";
import { formatDateTime } from "../../../format";
import { statusLabel } from "../../../types";
import { ReadonlyField } from "../../../components/ReadonlyField";

const TYPE_LABEL: Record<string, string> = { "R-FULL": "Full restore", "R-DB": "Database only", "R-OBJ": "Documents only", "R-ONE": "One record" };
const TARGET_LABEL: Record<string, string> = { VALIDATION: "Validation environment", PRODUCTION: "Production (replaces live data)" };
/** Text areas are fixed in size: a reason is read, not edited, and resizing it would change the layout of the page. */
const TEXTAREA_CLASS = `${CONTROL_STATE_CLASSES.readonlyField} resize-none`;

/** The request itself: what is asked, by whom, and how it was decided. Read only; the decision is made from the page header. */
export const RequestInformationTab: React.FC<{ request: RestoreRequestRecord }> = ({ request }) => {
  const approved = request.status === "APPROVED";
  const rejected = request.status === "REJECTED";
  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <ReadonlyField label="Restore Number" value={request.restoreNumber} />
        <ReadonlyField label="Status" value={statusLabel(request.status)} />
        <ReadonlyField label="Type" value={TYPE_LABEL[request.type] ?? request.type} />
        <ReadonlyField label="Target" value={TARGET_LABEL[request.target] ?? request.target} />
        <ReadonlyField label="Change control" value={request.changeControlRef} />
        <ReadonlyField label="Test restore" value={request.rehearsalId} />
        <ReadonlyField label="Requested By" value={request.requestedBy} />
        <ReadonlyField label="Requested On" value={formatDateTime(request.requestedAt)} />
        <ReadonlyField label="Approved By" value={approved ? request.approvedBy : null} />
        <ReadonlyField label="Approved On" value={approved && request.decidedAt ? formatDateTime(request.decidedAt) : null} />
        <ReadonlyField label="Rejected By" value={rejected ? request.approvedBy : null} />
        <ReadonlyField label="Rejected On" value={rejected && request.decidedAt ? formatDateTime(request.decidedAt) : null} />
        <ReadonlyField label="E-signature" value={request.approvalSignatureRef} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs sm:text-sm font-medium text-slate-700">Reason</label>
        <textarea rows={3} value={request.reason} readOnly className={TEXTAREA_CLASS} />
      </div>
      {request.decisionReason && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Decision reason</label>
          <textarea rows={3} value={request.decisionReason} readOnly className={TEXTAREA_CLASS} />
        </div>
      )}
    </div>
  );
};
