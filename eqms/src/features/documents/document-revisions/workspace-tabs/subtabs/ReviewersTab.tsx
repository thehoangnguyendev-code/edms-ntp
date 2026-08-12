import React from "react";
import { ParticipantRosterTab } from "@/features/documents/shared/components/ParticipantRosterTab";
import { Reviewer } from "./types";

const REVIEWER_PERMISSION_CODE = "documents.revision.review";

interface ReviewersTabProps {
    onCountChange?: (count: number) => void;
    reviewers: Reviewer[];
    onReviewersChange: (reviewers: Reviewer[]) => void;
    isModalOpen?: boolean;
    onModalClose?: () => void;
    excludedUserIds?: string[];
}

export const ReviewersTab: React.FC<ReviewersTabProps> = ({
    onCountChange,
    reviewers,
    onReviewersChange,
    isModalOpen,
    onModalClose,
    excludedUserIds = [],
}) => (
    <ParticipantRosterTab
        roleLabel="Reviewer"
        permissionCode={REVIEWER_PERMISSION_CODE}
        participants={reviewers}
        onParticipantsChange={(participants) => onReviewersChange(participants as Reviewer[])}
        multiSelect
        allowRemove
        allowReorder
        onCountChange={onCountChange}
        isModalOpen={isModalOpen}
        onModalClose={onModalClose}
        excludedUserIds={excludedUserIds}
    />
);
