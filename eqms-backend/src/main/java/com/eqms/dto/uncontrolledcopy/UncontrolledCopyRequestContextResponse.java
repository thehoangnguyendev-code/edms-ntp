package com.eqms.dto.uncontrolledcopy;

import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;

public record UncontrolledCopyRequestContextResponse(
        String documentId,
        String documentNumber,
        String documentTitle,
        String documentTypeName,
        String documentStatus,
        String revisionId,
        String revisionNumber,
        String revisionStatus,
        /** Resolved eligible = true per the V503 eligibility rule matrix / per-document override. */
        boolean documentTypeEligible,
        boolean canRequest,
        boolean canRequestForOthers,
        String message,
        boolean approvalRequired,
        int validityHours,
        boolean allowRedownload,
        /** Watermark/stamp config the generated copy will carry (the mandatory title is always added on top). */
        ControlledCopyStatusMarking marking,
        /** The watermark title line every Uncontrolled Copy carries -- the policy's configured
         *  watermarkText, or the built-in default when left blank. Editable on the policy screen. */
        String mandatoryWatermarkText,
        /** DISTRIBUTION or DOCUMENT_VALID_UNTIL: what {@code validityHours} is counted from. */
        String validityBasis,
        /** The document's Valid Until date (dd/MM/yyyy), when it has one. */
        String documentValidUntil,
        /** The exact date and time the copy would be valid until, worked out now (only when the policy follows the document's Valid Until). */
        String computedValidUntil
) {
}
