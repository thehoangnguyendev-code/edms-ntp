package com.eqms.dto.document;

public record RevisionHistoryResponse(
        String id,
        String actionType,
        String fromStatus,
        String toStatus,
        String comment,
        String actedBy,
        String created
) {
}
