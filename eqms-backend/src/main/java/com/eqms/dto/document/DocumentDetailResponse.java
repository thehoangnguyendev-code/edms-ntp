package com.eqms.dto.document;

import java.util.List;

public record DocumentDetailResponse(
        String id,
        String documentNumber,
        String documentName,
        String titleLocalLanguage,
        String version,
        String status,
        StatusResponse statusInfo,
        String type,
        String businessUnit,
        String department,
        String author,
        String owner,
        String openedBy,
        String created,
        String effectiveDate,
        String validUntil,
        String reviewDate,
        String description,
        String knowledgeBase,
        String subType,
        /** NONE/SINGLE/MULTIPLE/FLEXIBLE resolved from the Sub-Type's configured requirement --
         * lets the client show "Not Required" instead of an ambiguous empty reviewer list. */
        String reviewRequirement,
        Integer periodicReviewCycle,
        Integer periodicReviewNotification,
        String language,
        boolean requiresTraining,
        Integer trainingPeriodDays,
        String reasonForSkippingTraining,
        boolean isTemplate,
        String lastModifiedDate,
        String lastModifiedBy,
        boolean hasRelatedDocuments,
        boolean hasCorrelatedDocuments,
        int reviewerCount,
        int approverCount,
        List<DocumentParticipantResponse> coAuthors,
        List<DocumentParticipantResponse> reviewers,
        List<DocumentParticipantResponse> approvers,
        List<DocumentRelationResponse> relatedDocuments,
        List<DocumentRelationResponse> correlatedDocuments,
        List<DocumentRevisionSummaryResponse> revisions,
        List<SignatureResponse> signatures,
        boolean canUploadRevision,
        boolean canRequestControlledCopy,
        String nextDraftRevisionNumber,
        String authorId,
        /** Changes whenever the published PDF this Document's "Document" preview tab serves
         *  changes (a new Revision becomes EFFECTIVE, or its published PDF is regenerated) -- lets
         *  the FE detect a stale-showing preview without re-downloading the PDF bytes just to
         *  compare them. Null when there is no published PDF yet (no cache-busting needed). */
        String previewVersionToken
) {
}
