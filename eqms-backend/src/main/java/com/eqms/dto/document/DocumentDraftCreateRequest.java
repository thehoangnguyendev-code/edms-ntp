package com.eqms.dto.document;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record DocumentDraftCreateRequest(
        String documentName,
        String titleLocalLanguage,
        String documentType,
        String author,
        String businessUnit,
        String department,
        String knowledgeBase,
        String subType,
        Integer periodicReviewCycle,
        Integer periodicReviewNotification,
        String language,
        Boolean requiresTraining,
        Integer trainingPeriodDays,
        String reasonForSkippingTraining,
        String trainingPlannedDate,
        String trainingPeriodEndDate,
        String trainingCompletionDate,
        String reviewDate,
        String description,
        Boolean isTemplate,
        List<String> coAuthorIds,
        List<String> reviewerUserIds,
        List<String> approverUserIds,
        List<String> relatedDocumentIds,
        List<String> correlatedDocumentIds
) {
}
