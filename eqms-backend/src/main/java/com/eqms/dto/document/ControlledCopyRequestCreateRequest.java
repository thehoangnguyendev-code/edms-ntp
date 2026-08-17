package com.eqms.dto.document;

import jakarta.validation.constraints.Size;

import java.util.List;

public record ControlledCopyRequestCreateRequest(
        @Size(max = 100) String documentId,
        @Size(max = 100) String documentNumber,
        @Size(max = 100) String sourceRevisionId,
        @Size(max = 255) String requestedBy,
        @Size(max = 255) String department,
        @Size(max = 255) String location,
        @Size(max = 2000) String purpose,
        Integer copies,
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
