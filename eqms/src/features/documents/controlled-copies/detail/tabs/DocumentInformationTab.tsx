import React from "react";
import { ControlledCopy } from "../../types";
import { formatDateNumeric, formatDateTimePartsNumeric } from "@/utils/format";
import {
  formatControlledCopyNumber,
  formatDocumentLabel,
  formatDocumentRevisionLabel,
} from "../../display";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";

interface DocumentInformationTabProps {
  controlledCopy: ControlledCopy;
  isBatchParent?: boolean;
  onNavigateToLinkedCopy?: (id: string) => void;
}

const yesNo = (value?: boolean | null) => (value ? "Yes" : "No");
const displayText = (value?: string | number | null) => {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
};

export const DocumentInformationTab: React.FC<DocumentInformationTabProps> = ({
  controlledCopy,
  isBatchParent = false,
  onNavigateToLinkedCopy,
}) => {
  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">

        {/* Controlled Copy Number / Batch Number */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            {isBatchParent ? "Batch Number" : "Controlled Copy Number"}
          </label>
          <input
            type="text"
            value={formatControlledCopyNumber(controlledCopy.controlledCopyNumber)}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Created */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Created
          </label>
          <input
            type="text"
            value={formatDateTimePartsNumeric(controlledCopy.createdDate, controlledCopy.createdTime)}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Opened by */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Opened by
          </label>
          <input
            type="text"
            value={controlledCopy.openedBy}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Business Unit */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Business Unit
          </label>
          <input
            type="text"
            value={controlledCopy.businessUnit || ""}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Controlled Copy Name - Full width */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Controlled Copy Name
          </label>
          <input
            type="text"
            value={controlledCopy.name}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Document */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Document
          </label>
          <input
            type="text"
            value={
              formatDocumentLabel(controlledCopy)
              || controlledCopy.documentName
              || ""
            }
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Document Revision */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Document Revision
          </label>
          <input
            type="text"
            value={formatDocumentRevisionLabel(controlledCopy)}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Valid Until */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Valid Until
          </label>
          <input
            type="text"
            value={formatDateNumeric(controlledCopy.validUntil)}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Expiry Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Expiry Date
          </label>
          <input
            type="text"
            value={formatDateNumeric(controlledCopy.expiryDate || "")}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
          {controlledCopy.hasExpiryDate && controlledCopy.expiryDate && controlledCopy.status === "Obsoleted" && (
            <p className="text-[11px] sm:text-xs text-amber-600 font-medium">
              This controlled copy has been automatically obsoleted because the expiry date was reached.
            </p>
          )}
        </div>

        {/* Revision */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Revision
          </label>
          <input
            type="text"
            value={controlledCopy.revisionNumber || ""}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Copy Number / Quantity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            {isBatchParent ? "Quantity" : "Copy Number"}
          </label>
          <div className="space-y-1.5">
            <input
              type="text"
              value={isBatchParent ? (controlledCopy.totalCopies?.toString() || "0") : (controlledCopy.copyNumber?.toString() || "1")}
              readOnly
              className={CONTROL_STATE_CLASSES.readonlyField}
            />
            <p className="text-[11px] sm:text-xs font-normal text-slate-400 flex items-center gap-1">
              {isBatchParent
                ? "The Quantity field represents the total number of controlled copies in this batch"
                : "The Copy Number field represents the n'th copy of the related revision"}
            </p>
          </div>
        </div>

        {/* Total Copies Number */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Total Copies Number
          </label>
          <div className="space-y-1.5">
            <input
              type="text"
              value={controlledCopy.totalCopies?.toString() || "1"}
              readOnly
              className={CONTROL_STATE_CLASSES.readonlyField}
            />
            <p className="text-[11px] sm:text-xs font-normal text-slate-400 flex items-center gap-1">
              {isBatchParent
                ? "The Total Copies Number field matches the total quantity assigned to this batch"
                : "The Total Copies Number field represents the total number of all copies of the related revision"}
            </p>
          </div>
        </div>

        {/* Recall Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Recall Date
          </label>
          <input
            type="text"
            value={formatDateNumeric(controlledCopy.recallDate || "")}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Lost/Damaged report trace. These values are returned by the server
            and remain available after the copy is marked Obsoleted. */}
        {(controlledCopy.destructionType || controlledCopy.destroyedBy || controlledCopy.destroyedDate || controlledCopy.destroyReason) && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">Report Type</label>
              <input type="text" value={displayText(controlledCopy.destructionType)} readOnly className={CONTROL_STATE_CLASSES.readonlyField} />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs sm:text-sm font-medium text-slate-700">Report Reason</label>
              <textarea value={displayText(controlledCopy.destroyReason)} readOnly rows={2} className={CONTROL_STATE_CLASSES.readonlyTextarea} />
            </div>
          </>
        )}

        {/* Reissue trace. Only set on the new record (Reissued from) or the original
            Lost/Damaged record it replaced (Replaced by). */}
        {controlledCopy.replacedControlledCopyId && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">Reissued From</label>
            <button
              type="button"
              onClick={() => onNavigateToLinkedCopy?.(controlledCopy.replacedControlledCopyId!)}
              disabled={!onNavigateToLinkedCopy}
              className="flex h-9 w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-left text-sm font-medium text-emerald-600 hover:underline disabled:cursor-default disabled:text-slate-700 disabled:no-underline"
            >
              {formatControlledCopyNumber(controlledCopy.replacedControlledCopyNumber) || "-"}
            </button>
          </div>
        )}
        {controlledCopy.replacementControlledCopyId && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">Replaced By</label>
            <button
              type="button"
              onClick={() => onNavigateToLinkedCopy?.(controlledCopy.replacementControlledCopyId!)}
              disabled={!onNavigateToLinkedCopy}
              className="flex h-9 w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-left text-sm font-medium text-emerald-600 hover:underline disabled:cursor-default disabled:text-slate-700 disabled:no-underline"
            >
              {formatControlledCopyNumber(controlledCopy.replacementControlledCopyNumber) || "-"}
            </button>
          </div>
        )}

        {/* Comments - Full width */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Comments
          </label>
          <textarea
            value={controlledCopy.distributionComment || controlledCopy.reason || ""}
            readOnly
            rows={3}
            className={CONTROL_STATE_CLASSES.readonlyTextarea}
          />
        </div>
      </div>

    </div>
  );
};
