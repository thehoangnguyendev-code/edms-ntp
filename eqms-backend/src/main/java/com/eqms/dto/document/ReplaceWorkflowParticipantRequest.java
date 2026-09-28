package com.eqms.dto.document;

/** Document Control hands a pending Review/Approval assignment to another user. */
public record ReplaceWorkflowParticipantRequest(
        String participantType,
        java.util.UUID fromUserId,
        java.util.UUID toUserId,
        String reason,
        String signatureToken
) {
}
