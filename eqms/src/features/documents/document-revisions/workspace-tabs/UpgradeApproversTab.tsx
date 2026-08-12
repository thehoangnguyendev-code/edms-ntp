import React from "react";
import { ApproversTab } from "./subtabs/ApproversTab";
import type { Approver } from "@/features/documents/types";

interface UpgradeApproversTabProps {
  approvers: Approver[];
  onApproversChange: (approvers: Approver[]) => void;
  isModalOpen: boolean;
  onModalClose: () => void;
}

export const UpgradeApproversTab: React.FC<UpgradeApproversTabProps> = ({
  approvers,
  onApproversChange,
  isModalOpen,
  onModalClose,
}) => {
  return (
    <ApproversTab
      approvers={approvers as any}
      onApproversChange={(nextApprovers) => onApproversChange(nextApprovers as Approver[])}
      isModalOpen={isModalOpen}
      onModalClose={onModalClose}
    />
  );
};
