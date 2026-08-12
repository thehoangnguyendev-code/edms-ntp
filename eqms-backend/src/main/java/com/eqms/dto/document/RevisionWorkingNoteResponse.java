package com.eqms.dto.document;

public record RevisionWorkingNoteResponse(
        String id,
        String author,
        String authorUsername,
        String timestamp,
        String content,
        String workflowStage,
        String workflowStageLabel,
        boolean canDelete
) {
}
