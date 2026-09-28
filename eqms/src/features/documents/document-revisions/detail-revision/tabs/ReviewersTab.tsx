import React from "react";
import { SignedParticipantTab, type SignedParticipantItem } from "@/features/documents/document-revisions/shared/components/SignedParticipantTab";

interface Reviewer {
  id: string;
  name: string;
  signedOn?: string;
}

interface ReviewersTabProps {
  reviewers: Reviewer[];
  reviewRequirement?: "NONE" | "REQUIRED" | null;
  /** Legacy Import reference-only reviewer(s) -- recorded from the paper original, never a real
   *  electronic signature. Comma-separated names as entered at import time. */
  legacyHistoricalReviewers?: string | null;
  legacyHistoricalReviewDate?: string | null;
}

export const ReviewersTab: React.FC<ReviewersTabProps> = ({
  reviewers,
  reviewRequirement,
  legacyHistoricalReviewers,
  legacyHistoricalReviewDate,
}) => {
  if (reviewRequirement === "NONE" && !legacyHistoricalReviewers) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">Review is not required for this Document Type and Sub-Type.</div>;
  }
  const items: SignedParticipantItem[] = reviewers.map((reviewer) => ({
    id: reviewer.id,
    displayName: reviewer.name,
    signedOn: reviewer.signedOn ?? "",
  }));
  if (legacyHistoricalReviewers) {
    items.push({
      id: "legacy-reviewer",
      displayName: legacyHistoricalReviewers,
      signedOn: legacyHistoricalReviewDate ?? "",
      isLegacy: true,
    });
  }

  return <SignedParticipantTab labelPrefix="Reviewer" items={items} />;
};
