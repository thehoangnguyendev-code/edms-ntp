package com.eqms.dto.document;

public record RevisionWorkflowActionRequest(
        String comment,
        String reason,
        String signatureToken,
        Boolean forcePublish,
        String trainingPlannedDate,
        String trainingPeriodEndDate,
        String trainingCompletionDate
) {
    public RevisionWorkflowActionRequest(String comment, String reason, String signatureToken) {
        this(comment, reason, signatureToken, null, null, null, null);
    }

    public RevisionWorkflowActionRequest(String comment, String reason, String signatureToken, Boolean forcePublish) {
        this(comment, reason, signatureToken, forcePublish, null, null, null);
    }

    public RevisionWorkflowActionRequest(String comment, String reason, String signatureToken, boolean forcePublish) {
        this(comment, reason, signatureToken, Boolean.valueOf(forcePublish), null, null, null);
    }
}
