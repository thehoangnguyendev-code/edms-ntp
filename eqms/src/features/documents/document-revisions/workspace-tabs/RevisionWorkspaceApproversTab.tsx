import React from "react";
import { ParticipantSignatureFields, type ParticipantSignatureRecord } from "@/features/documents/document-revisions/shared/components/ParticipantSignatureFields";
import type { Approver } from "@/features/documents/types";

interface RevisionWorkspaceApproversTabProps {
  approvers: Approver[];
}

export const RevisionWorkspaceApproversTab: React.FC<RevisionWorkspaceApproversTabProps> = ({ approvers }) => {
  const items: ParticipantSignatureRecord[] = approvers.map((approver, index) => ({
    label: `Approver ${index + 1}`,
    name: approver.fullName || approver.username || approver.id || "",
    signedOn: approver.signedOn || approver.actedAt || "",
  }));

  return <ParticipantSignatureFields records={items} />;
};
