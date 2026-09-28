package com.eqms.dto.controlledcopypolicy;

import java.util.Map;

/**
 * What an administrator is looking at on the PDF Markings tab. The marks are the draft being edited (not yet saved); the server
 * draws them on a page of the chosen Publishing Template and returns the picture.
 */
public record ControlledCopyMarkingPreviewRequest(
        /** Publishing Template to take the page from. */
        String templateId,
        /** portrait | landscape */
        String layout,
        /** COVER (page 1) | BODY (page 2 onwards) */
        String pageKind,
        /** ISSUED | OBSOLETED | CLOSED_CANCELLED */
        String scenario,
        /** For OBSOLETED: RECALLED, EXPIRED, NEW_REVISION_PUBLISHED, ... */
        String reason,
        ControlledCopyPolicyDistributionSecuritySection distributionSecurity,
        ControlledCopyPolicyMarkingSection marking,
        Map<String, ControlledCopyStatusMarking> statusMarking
) {
}
