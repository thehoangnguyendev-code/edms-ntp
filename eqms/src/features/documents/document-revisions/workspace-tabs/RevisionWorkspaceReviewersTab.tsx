import React from "react";
import { ParticipantSignatureFields, type ParticipantSignatureRecord } from "@/features/documents/document-revisions/shared/components/ParticipantSignatureFields";
import type { Reviewer } from "@/features/documents/types";

interface RevisionWorkspaceReviewersTabProps {
  reviewers: Reviewer[];
  reviewRequirement?: "NONE" | "SINGLE" | "MULTIPLE" | null;
}

export const RevisionWorkspaceReviewersTab: React.FC<RevisionWorkspaceReviewersTabProps> = ({ reviewers, reviewRequirement }) => {
  if (reviewRequirement === "NONE") {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">Review is not required for this Document Type and Sub-Type.</div>;
  }
  const items: ParticipantSignatureRecord[] = reviewers.map((reviewer, index) => ({
    label: `Reviewer ${index + 1}`,
    name: reviewer.fullName || reviewer.username || reviewer.id || "",
    signedOn: reviewer.signedOn || reviewer.actedAt || "",
  }));

  return <ParticipantSignatureFields records={items} />;
};
