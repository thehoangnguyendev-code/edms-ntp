import React from "react";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";

interface InfoFromDocumentTabProps {
  documentCode?: string;
  documentName?: string;
  displayName?: string;
  documentCreated?: string;
}

const displayValue = (value?: string | null) =>
  value && value.trim() ? value : "-";

export const InfoFromDocumentTab: React.FC<InfoFromDocumentTabProps> = ({
  documentCode,
  documentName,
  displayName,
  documentCreated,
}) => {
  const formattedName = documentCode && documentName
    ? `${documentCode} - ${documentName}`
    : displayName || documentName || documentCode || "";

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Document Name</label>
          <input
            type="text"
            value={displayValue(formattedName)}
            readOnly
            placeholder="-"
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Document Number</label>
          <input
            type="text"
            value={displayValue(documentCode)}
            readOnly
            placeholder="-"
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Document Created</label>
          <input
            type="text"
            value={displayValue(documentCreated)}
            readOnly
            placeholder="-"
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>
      </div>
    </div>
  );
};
