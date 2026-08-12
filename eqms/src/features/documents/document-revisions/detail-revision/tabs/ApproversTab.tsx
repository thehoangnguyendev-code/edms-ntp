import React from "react";
import { SignedParticipantTab, type SignedParticipantItem } from "@/features/documents/document-revisions/shared/components/SignedParticipantTab";

interface Approver {
  id: string;
  name: string;
  signedOn?: string;
}

interface ApproversTabProps {
  approvers: Approver[];
}

export const ApproversTab: React.FC<ApproversTabProps> = ({ approvers }) => {
  const items: SignedParticipantItem[] = approvers.map((approver) => ({
    id: approver.id,
    displayName: approver.name,
    signedOn: approver.signedOn ?? "",
  }));

  return <SignedParticipantTab labelPrefix="Approver" items={items} />;
};
