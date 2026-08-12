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
    isReadOnly?: boolean;
    excludedUserIds?: string[];
    /** When editing an existing revision, candidate eligibility is evaluated by the server
     * against that revision's permission scope and separation-of-duties rules. */
    revisionId?: string | null;
    /** Once the current roster has been saved to the backend, its order/membership is frozen
     * there (DocumentService rejects any change to an already-saved reviewer list) — so the
     * drag-reorder and remove affordances must be disabled to match, instead of letting the user
     * rearrange/remove locally and only find out at Save time that it was rejected. */
    isLocked?: boolean;
}

export const ReviewersTab: React.FC<ReviewersTabProps> = ({
    onCountChange,
    reviewers,
    onReviewersChange,
    isModalOpen,
    onModalClose,
    isReadOnly = false,
    excludedUserIds = [],
    isLocked = false,
    revisionId,
}) => (
    <ParticipantRosterTab
        roleLabel="Reviewer"
        permissionCode={REVIEWER_PERMISSION_CODE}
        revisionId={revisionId}
        participants={reviewers}
        onParticipantsChange={(participants) => onReviewersChange(participants as Reviewer[])}
        multiSelect
        allowRemove={!isLocked}
        allowReorder={!isLocked}
        onCountChange={onCountChange}
        isModalOpen={isModalOpen}
        onModalClose={onModalClose}
        isReadOnly={isReadOnly}
        excludedUserIds={excludedUserIds}
    />
);
