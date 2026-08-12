import React from "react";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";

export interface ParticipantSignatureRecord {
  label: string;
  name: string;
  signedOn?: string | null;
}

interface ParticipantSignatureFieldsProps {
  records: ParticipantSignatureRecord[];
}

const normalizeValue = (value?: string | null) => (value && value.trim() ? value : "-");

export const ParticipantSignatureFields: React.FC<ParticipantSignatureFieldsProps> = ({ records }) => {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
        No reviewer or approver has been assigned yet.
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {records.map((record, index) => (
          <React.Fragment key={`${record.label}-${index}`}>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">
                {record.label}
              </label>
              <input
                type="text"
                value={normalizeValue(record.name)}
                readOnly
                placeholder="-"
                className={CONTROL_STATE_CLASSES.readonlyField}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">
                Signed On (Date - Time)
              </label>
              <input
                type="text"
                value={normalizeValue(record.signedOn)}
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
