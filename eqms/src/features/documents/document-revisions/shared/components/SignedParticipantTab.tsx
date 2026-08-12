import React from "react";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";

export interface SignedParticipantItem {
  id: string;
  displayName: string;
  signedOn?: string | null;
}

interface SignedParticipantTabProps {
  labelPrefix: "Reviewer" | "Approver";
  items: SignedParticipantItem[];
}

export const SignedParticipantTab: React.FC<SignedParticipantTabProps> = ({
  labelPrefix,
  items,
}) => {
  const rows = items.length > 0
    ? items
    : [{ id: "empty", displayName: "", signedOn: undefined }];

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {rows.map((item, index) => (
          <React.Fragment key={item.id}>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">
                {labelPrefix} {index + 1}
              </label>
              <input
                type="text"
                value={item.displayName || ""}
                readOnly
                placeholder="—"
                className={CONTROL_STATE_CLASSES.readonlyField}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">
                Signed On (Date - Time)
              </label>
              <input
                type="text"
                value={item.signedOn || ""}
                readOnly
                placeholder="—"
                className={CONTROL_STATE_CLASSES.readonlyField}
              />
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

