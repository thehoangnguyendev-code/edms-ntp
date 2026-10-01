package com.eqms.dto.document;

import jakarta.validation.constraints.Size;

import java.util.List;

public record ControlledCopyRequestCreateRequest(
        @Size(max = 100) String documentId,
        @Size(max = 100) String documentNumber,
        @Size(max = 100) String sourceRevisionId,
        @Size(max = 255) String requestedBy,
        // RequestControlledCopyView.tsx joins every selected department/business-unit label into
        // this one field with ", " for an "internal" request -- with enough recipients selected
        // that routinely exceeds 255 chars. This value is display-only (ControlledCopyService never
        // persists it: the entity's departmentName comes from the source Document's own
        // department), so there is no reason to reject a long one; 255 was simply too tight and
        // failed real submissions with an opaque "Invalid request data" toast.
        @Size(max = 5000) String department,
        // Unlike department above, this one IS persisted (ControlledCopyService.setLocation) into
        // an entity column that is genuinely length=255 -- keep this cap matching that column so a
        // long value fails here with a clear 422 instead of a raw DB constraint violation.
        @Size(max = 255) String location,
        @Size(max = 2000) String purpose,
        Integer copies,
        // "PAPER" (default, every existing request stays unaffected) or "ELECTRONIC" -- only
        // meaningful, and only accepted by the service, when the target Document's
        // FormSettings.allowEform is true.
        @Size(max = 20) String deliveryMode,
        @Size(max = 100) String distributionMode,
        @Size(max = 100) String distributionScope,
        Boolean hasExpiryDate,
        @Size(max = 100) String expiryDate,
        List<String> locationIds,
        List<String> locationNames,
        List<String> recipientIds,
        List<String> recipientLabels,
        List<String> externalRecipients,
        @Size(max = 2000) String reason,
        Integer quantity,
        @Size(max = 10000) String signature,
        @Size(max = 10000) String signatureToken,
        List<ControlledCopyRecipientRequest> recipients
) {
    public record ControlledCopyRecipientRequest(
            String recipientType,
            String recipientUserId,
            String recipientEmail,
            String department,
            String location,
            Integer quantity
    ) {
    }
}
