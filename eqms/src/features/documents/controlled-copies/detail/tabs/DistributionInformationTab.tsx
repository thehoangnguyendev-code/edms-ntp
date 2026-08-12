import React from "react";
import { ControlledCopy } from "../../types";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { getControlledCopyDistributionListText, getControlledCopyDistributionModeLabel } from "../../distributionDisplay";

interface DistributionInformationTabProps {
  controlledCopy: ControlledCopy & { copyIds?: string[] };
}

const ReadonlyField: React.FC<{
  label: string;
  value?: string | null;
  fullWidth?: boolean;
}> = ({ label, value, fullWidth = false }) => (
  <div className={`flex flex-col gap-1.5 ${fullWidth ? "md:col-span-2" : ""}`}>
    <label className="text-xs sm:text-sm font-medium text-slate-700">{label}</label>
    <input
      type="text"
      value={value || ""}
      readOnly
      className={CONTROL_STATE_CLASSES.readonlyField}
    />
  </div>
);

export const DistributionInformationTab: React.FC<DistributionInformationTabProps> = ({
  controlledCopy,
}) => {
  const distributionMode = getControlledCopyDistributionModeLabel(controlledCopy) || "None";
  const distributionRecipients = getControlledCopyDistributionListText(controlledCopy) || "";

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <ReadonlyField label="Distribution Mode" value={distributionMode} />
        <ReadonlyField
          label="Distribution List"
          value={distributionRecipients}
          fullWidth
        />
      </div>

    </div>
  );
};
