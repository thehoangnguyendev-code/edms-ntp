import React from "react";
import { ReviewersTab } from "./subtabs/ReviewersTab";
import type { Reviewer } from "@/features/documents/types";

interface UpgradeReviewersTabProps {
  reviewers: Reviewer[];
  onReviewersChange: (reviewers: Reviewer[]) => void;
  isModalOpen: boolean;
  onModalClose: () => void;
}

export const UpgradeReviewersTab: React.FC<UpgradeReviewersTabProps> = ({
  reviewers,
  onReviewersChange,
  isModalOpen,
  onModalClose,
}) => {
  return (
    <ReviewersTab
      reviewers={reviewers as any}
      onReviewersChange={(nextReviewers) => onReviewersChange(nextReviewers as Reviewer[])}
      isModalOpen={isModalOpen}
      onModalClose={onModalClose}
    />
  );
};
