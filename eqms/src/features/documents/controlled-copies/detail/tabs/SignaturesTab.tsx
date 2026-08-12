import React, { useMemo } from "react";
import type { AuditTrailRecord } from "@/features/audit-trail/types";
import { ControlledCopy } from "../../types";
import { formatDateTime } from "@/utils/format";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";

export interface SignatureRecord {
  actionBy: string;
  actionByName: string;
  actionOn: string;
  actionOnValue: string;
}

const displayValue = (value?: string | null) => (value && value.trim() ? value : "-");

const formatDateTimeDisplay = (value?: string | null) => {
  const formatted = formatDateTime(value || "");
  return formatted === "-" ? "-" : formatted.replace(", ", " ");
};

const combineDateTimeDisplay = (date?: string | null, time?: string | null) => {
  if (!date || !time || !date.trim() || !time.trim()) {
    return "";
  }
  return `${date.trim()} ${time.trim()}`;
};

interface SignaturesTabProps {
  controlledCopy: ControlledCopy;
  records?: SignatureRecord[];
  auditTrailRecords?: AuditTrailRecord[];
}

const ACTION_LABELS: Record<string, { by: string; on: string }> = {
  REQUEST: { by: "Requested By", on: "Requested On" },
  PRINT: { by: "Printed By", on: "Printed On" },
  DISTRIBUTE: { by: "Distributed By", on: "Distributed On" },
  RECALL: { by: "Recalled By", on: "Recalled On" },
  DESTROY: { by: "Destroyed By", on: "Destroyed On" },
  CANCEL: { by: "Cancelled By", on: "Cancelled On" },
};

const AUDIT_ACTION_ORDER = ["REQUEST", "PRINT", "DISTRIBUTE", "RECALL", "DESTROY", "CANCEL"];

const buildControlledCopyFallbackRecords = (controlledCopy: ControlledCopy): SignatureRecord[] => [
  {
    actionBy: "Requested By",
    actionByName: displayValue(controlledCopy.requestedBy || controlledCopy.openedBy || ""),
    actionOn: "Requested On",
    actionOnValue: formatDateTimeDisplay(
      combineDateTimeDisplay(controlledCopy.createdDate, controlledCopy.createdTime) || controlledCopy.requestDate
    ),
  },
  {
    actionBy: "Printed By",
    actionByName: displayValue(controlledCopy.printedBy || ""),
    actionOn: "Printed On",
    actionOnValue: formatDateTimeDisplay(controlledCopy.printedDate || ""),
  },
  {
    actionBy: "Distributed By",
    actionByName: displayValue(controlledCopy.distributedBy || ""),
    actionOn: "Distributed On",
    actionOnValue: formatDateTimeDisplay(controlledCopy.distributedDate || ""),
  },
  {
    actionBy: "Recalled By",
    actionByName: displayValue(controlledCopy.recalledBy || ""),
    actionOn: "Recalled On",
    actionOnValue: formatDateTimeDisplay(controlledCopy.recallDate || ""),
  },
  {
    actionBy: "Destroyed By",
    actionByName: displayValue(controlledCopy.destroyedBy || ""),
    actionOn: "Destroyed On",
    actionOnValue: formatDateTimeDisplay(controlledCopy.destroyedDate || ""),
  },
  {
    actionBy: "Cancelled By",
    actionByName: displayValue(""),
    actionOn: "Cancelled On",
    actionOnValue: displayValue(""),
  },
];

export const SignaturesTab: React.FC<SignaturesTabProps> = ({
  controlledCopy,
  records = [],
  auditTrailRecords = [],
}) => {
  const signatureRecords = useMemo<SignatureRecord[]>(() => {
    if (records.length > 0) {
      return records.map((record) => ({
        actionBy: record.actionBy,
        actionByName: displayValue(record.actionByName),
        actionOn: record.actionOn,
        actionOnValue: formatDateTimeDisplay(record.actionOnValue),
      }));
    }

    const normalizedAuditRows = auditTrailRecords
      .filter((record) => ACTION_LABELS[String(record.action || "").toUpperCase()])
      .sort((left, right) => {
        const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
        const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
        return leftTime - rightTime;
      });

    if (normalizedAuditRows.length > 0) {
      const latestByAction = new Map<string, AuditTrailRecord>();
      normalizedAuditRows.forEach((record) => {
        latestByAction.set(String(record.action || "").toUpperCase(), record);
      });

      return AUDIT_ACTION_ORDER
        .map((action) => {
          const record = latestByAction.get(action);
          if (!record) {
            return null;
          }
          const labels = ACTION_LABELS[action];
          return {
            actionBy: labels.by,
            actionByName: displayValue(record.fullName || record.user?.fullName || ""),
            actionOn: labels.on,
            actionOnValue: record.timestamp ? formatDateTimeDisplay(record.timestamp) : "-",
          };
        })
        .filter((record): record is SignatureRecord => record !== null);
    }

    return buildControlledCopyFallbackRecords(controlledCopy);
  }, [auditTrailRecords, controlledCopy, records]);

  const hasReportConfirmation = Boolean(
    controlledCopy.destructionType || controlledCopy.destroyedBy || controlledCopy.destroyedDate || controlledCopy.witnessedBy
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {signatureRecords.map((record, index) => (
          <React.Fragment key={index}>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">
                {record.actionBy}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={displayValue(record.actionByName)}
                  readOnly
                  className={CONTROL_STATE_CLASSES.readonlyField}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">
                {record.actionOn}
              </label>
              <input
                type="text"
                value={displayValue(record.actionOnValue)}
                readOnly
                className={CONTROL_STATE_CLASSES.readonlyField}
              />
            </div>
          </React.Fragment>
        ))}

        {hasReportConfirmation && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">Reported By</label>
              <input type="text" value={displayValue(controlledCopy.destroyedBy)} readOnly className={CONTROL_STATE_CLASSES.readonlyField} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">Reported On</label>
              <input type="text" value={formatDateTimeDisplay(controlledCopy.destroyedDate)} readOnly className={CONTROL_STATE_CLASSES.readonlyField} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">Witnessed By</label>
              <input type="text" value={displayValue(controlledCopy.witnessedBy)} readOnly className={CONTROL_STATE_CLASSES.readonlyField} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
