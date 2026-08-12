package com.eqms.dto.document;

public record RevisionSnapshotHistoryResponse(
        String id,
        int reviewRound,
        String triggerAction,
        String generatedAt,
        String generatedByName
) {
}
