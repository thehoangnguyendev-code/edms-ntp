import React from "react";
import { SignedParticipantTab, type SignedParticipantItem } from "@/features/documents/document-revisions/shared/components/SignedParticipantTab";

interface Approver {
  id: string;
  name: string;
  signedOn?: string;
}

interface ApproversTabProps {
  approvers: Approver[];
  /** Legacy Import reference-only approver -- recorded from the paper original, never a real
   *  electronic signature. */
  legacyHistoricalApprover?: string | null;
  legacyHistoricalApprovalDate?: string | null;
}

export const ApproversTab: React.FC<ApproversTabProps> = ({
  approvers,
  legacyHistoricalApprover,
  legacyHistoricalApprovalDate,
}) => {
  const items: SignedParticipantItem[] = approvers.map((approver) => ({
    id: approver.id,
    displayName: approver.name,
    signedOn: approver.signedOn ?? "",
  }));
  if (legacyHistoricalApprover) {
    items.push({
      id: "legacy-approver",
      displayName: legacyHistoricalApprover,
      signedOn: legacyHistoricalApprovalDate ?? "",
      isLegacy: true,
    });
  }

  return <SignedParticipantTab labelPrefix="Approver" items={items} />;
};
