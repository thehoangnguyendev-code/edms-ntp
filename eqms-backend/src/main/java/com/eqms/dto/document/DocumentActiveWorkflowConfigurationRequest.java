package com.eqms.dto.document;

import java.util.List;

/** DCO-managed setup for the next revision of an Active document. */
public record DocumentActiveWorkflowConfigurationRequest(
        List<String> reviewerUserIds,
        List<String> approverUserIds,
        List<String> relatedDocumentIds,
        List<String> correlatedDocumentIds,
        String reviewDate,
        Boolean requiresTraining,
        Integer trainingPeriodDays,
        String reasonForSkippingTraining,
        String authorUserId,
        List<String> coAuthorUserIds,
        Integer periodicReviewCycle,
        Integer periodicReviewNotification,
        String description
) {}
