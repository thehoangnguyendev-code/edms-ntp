package com.eqms.dto.controlledcopypolicy;

import java.util.Map;

/**
 * What an administrator is looking at on the PDF Markings tab. The marks are the draft being edited (not yet saved); the server
 * draws them on a sample paper page and returns the picture.
 */
public record ControlledCopyMarkingPreviewRequest(
        /** ISSUED | OBSOLETED | CLOSED_CANCELLED */
        String scenario,
        /** For OBSOLETED: RECALLED, EXPIRED, NEW_REVISION_PUBLISHED, ... */
        String reason,
        ControlledCopyPolicyDistributionSecuritySection distributionSecurity,
        ControlledCopyPolicyMarkingSection marking,
        Map<String, ControlledCopyStatusMarking> statusMarking
) {
}
