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
        List<String> correlatedDocumentIds,
        // Legacy Import only (see DocumentService#applyDraftFields): honored solely when the
        // caller holds documents.legacy_import.manage, silently ignored otherwise -- an ordinary
        // caller sending none of these gets exactly today's auto-generated document number.
        String legacyDocumentNumber,
        String legacyOriginalEffectiveDate,
        String legacyJustification
) {
}
