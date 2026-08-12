import React from "react";
import { SignedParticipantTab, type SignedParticipantItem } from "@/features/documents/document-revisions/shared/components/SignedParticipantTab";

interface Reviewer {
  id: string;
  name: string;
  signedOn?: string;
}

interface ReviewersTabProps {
  reviewers: Reviewer[];
  reviewRequirement?: "NONE" | "SINGLE" | "MULTIPLE" | null;
}

export const ReviewersTab: React.FC<ReviewersTabProps> = ({ reviewers, reviewRequirement }) => {
  if (reviewRequirement === "NONE") {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">Review is not required for this Document Type and Sub-Type.</div>;
  }
  const items: SignedParticipantItem[] = reviewers.map((reviewer) => ({
    id: reviewer.id,
    displayName: reviewer.name,
    signedOn: reviewer.signedOn ?? "",
  }));

  return <SignedParticipantTab labelPrefix="Reviewer" items={items} />;
};
