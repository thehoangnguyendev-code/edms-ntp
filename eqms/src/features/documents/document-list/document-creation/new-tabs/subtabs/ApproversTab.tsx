import React from "react";
import { ParticipantRosterTab } from "@/features/documents/shared/components/ParticipantRosterTab";
import { Approver } from "./types";

const APPROVER_PERMISSION_CODE = "documents.revision.approve";

interface ApproversTabProps {
    onCountChange?: (count: number) => void;
    isModalOpen?: boolean;
    onModalClose?: () => void;
    approvers?: Approver[];
    onApproversChange?: (approvers: Approver[]) => void;
    isReadOnly?: boolean;
    excludedUserIds?: string[];
    /** See ReviewersTab.revisionId. */
    revisionId?: string | null;
    /** See ReviewersTab.isLocked — once saved, DocumentService rejects any change to an
     * already-saved approver too, so remove must be disabled to match. */
    isLocked?: boolean;
}

export const ApproversTab: React.FC<ApproversTabProps> = ({
    onCountChange,
    isModalOpen,
    onModalClose,
    approvers = [],
    onApproversChange = () => {},
    isReadOnly = false,
    excludedUserIds = [],
    isLocked = false,
    revisionId,
}) => (
    <ParticipantRosterTab
        roleLabel="Approver"
        permissionCode={APPROVER_PERMISSION_CODE}
        revisionId={revisionId}
        participants={approvers}
        onParticipantsChange={(participants) => onApproversChange(participants as Approver[])}
        multiSelect={false}
        allowRemove={!isLocked}
        allowReorder={false}
        onCountChange={onCountChange}
        isModalOpen={isModalOpen}
        onModalClose={onModalClose}
        isReadOnly={isReadOnly}
        excludedUserIds={excludedUserIds}
    />
);
