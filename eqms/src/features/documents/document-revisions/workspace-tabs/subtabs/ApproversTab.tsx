import React from "react";
import { ParticipantRosterTab } from "@/features/documents/shared/components/ParticipantRosterTab";
import { Approver } from "./types";

const APPROVER_PERMISSION_CODE = "documents.revision.approve";

interface ApproversTabProps {
    onCountChange?: (count: number) => void;
    isModalOpen?: boolean;
    onModalClose?: () => void;
    excludedUserIds?: string[];
    approvers?: Approver[];
    onApproversChange?: (approvers: Approver[]) => void;
}

export const ApproversTab: React.FC<ApproversTabProps> = ({
    onCountChange,
    isModalOpen,
    onModalClose,
    excludedUserIds = [],
    approvers = [],
    onApproversChange = () => {},
}) => (
    <ParticipantRosterTab
        roleLabel="Approver"
        permissionCode={APPROVER_PERMISSION_CODE}
        participants={approvers}
        onParticipantsChange={(participants) => onApproversChange(participants as Approver[])}
        multiSelect={false}
        allowRemove
        allowReorder={false}
        onCountChange={onCountChange}
        isModalOpen={isModalOpen}
        onModalClose={onModalClose}
        excludedUserIds={excludedUserIds}
    />
);
