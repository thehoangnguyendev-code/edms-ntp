import React from "react";
import { formatDateTime } from "@/utils/format";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";

export interface SignatureRecord {
  actionBy: string;
  actionByName: string;
  actionOn: string;
  actionOnValue: string;
}

export const DEFAULT_SIGNATURE_RECORDS: SignatureRecord[] = [
  { actionBy: "Submitted By", actionByName: "-", actionOn: "Submitted On (Date - Time)", actionOnValue: "-" },
  { actionBy: "Reviewed By", actionByName: "-", actionOn: "Reviewed On (Date - Time)", actionOnValue: "-" },
  { actionBy: "Rejected By", actionByName: "-", actionOn: "Rejected On (Date - Time)", actionOnValue: "-" },
  { actionBy: "Approved By", actionByName: "-", actionOn: "Approved On (Date - Time)", actionOnValue: "-" },
  { actionBy: "Published By", actionByName: "-", actionOn: "Published On (Date - Time)", actionOnValue: "-" },
  { actionBy: "Obsoleted By", actionByName: "-", actionOn: "Obsoleted On (Date - Time)", actionOnValue: "-" },
  { actionBy: "Cancelled By", actionByName: "-", actionOn: "Cancelled On (Date - Time)", actionOnValue: "-" },
];

const normalizeValue = (value?: string | null) => (value && value.trim() ? value : "-");

const displayDateTimeValue = (value?: string | null) => {
  const formatted = formatDateTime(value || "");
  return formatted === "-" ? "-" : formatted.replace(", ", " ");
};

const normalizeLabel = (value?: string | null) => String(value || "").trim().toLowerCase();
const baseLabel = (value?: string | null) => normalizeLabel(value).replace(/\s+\d+$/, "");

export const mapSignatureRecords = (
  records: SignatureRecord[] | undefined,
  onlyStatusFields = false,
): SignatureRecord[] => {
  if (records && records.length > 0) {
    const mapped = records.map((record) => ({
      actionBy: record.actionBy,
      actionByName: normalizeValue(record.actionByName),
      actionOn: record.actionOn,
      actionOnValue: normalizeValue(record.actionOnValue),
    }));

    return onlyStatusFields
      ? mapped.filter((field) => ["obsoleted by", "cancelled by"].includes(baseLabel(field.actionBy)))
      : mapped;
  }

  const mapped = DEFAULT_SIGNATURE_RECORDS.map((field) => ({
    actionBy: field.actionBy,
    actionByName: normalizeValue(field.actionByName),
    actionOn: field.actionOn,
    actionOnValue: normalizeValue(field.actionOnValue),
  }));

  return onlyStatusFields
    ? mapped.filter((field) => ["Obsoleted By", "Cancelled By"].includes(field.actionBy))
    : mapped;
};

interface SignatureFieldsProps {
  records?: SignatureRecord[];
  onlyStatusFields?: boolean;
  revisionId?: string;
}

export const SignatureFields: React.FC<SignatureFieldsProps> = ({
  records = [],
  onlyStatusFields = false,
}) => {
  const displayRecords = mapSignatureRecords(records, onlyStatusFields);

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {displayRecords.map((record, index) => (
          <React.Fragment key={`${record.actionBy}-${index}`}>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">
                {record.actionBy}
              </label>
              <input
                type="text"
                value={normalizeValue(record.actionByName)}
                readOnly
                placeholder="-"
                className={CONTROL_STATE_CLASSES.readonlyField}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">
                {record.actionOn}
              </label>
              <input
                type="text"
                value={displayDateTimeValue(record.actionOnValue)}
                readOnly
                placeholder="-"
                className={CONTROL_STATE_CLASSES.readonlyField}
              />
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
