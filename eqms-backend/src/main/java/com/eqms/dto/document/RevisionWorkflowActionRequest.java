package com.eqms.dto.document;

public record RevisionWorkflowActionRequest(
        String comment,
        String reason,
        String signatureToken,
        String trainingPlannedDate,
        String trainingPeriodEndDate,
        String trainingCompletionDate
) {
    public RevisionWorkflowActionRequest(String comment, String reason, String signatureToken) {
        this(comment, reason, signatureToken, null, null, null);
    }
}
