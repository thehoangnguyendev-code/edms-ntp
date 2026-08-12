package com.eqms.dto.document;

public record DocumentParticipantResponse(
        String id,
        String fullName,
        String username,
        String position,
        String email,
        String department,
        Integer sequenceOrder,
        String actionStatus,
        String actedAt,
        String actionComment
) {
}
