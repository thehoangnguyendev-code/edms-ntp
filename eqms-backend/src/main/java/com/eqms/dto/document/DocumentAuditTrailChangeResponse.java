package com.eqms.dto.document;

public record DocumentAuditTrailChangeResponse(
        String field,
        String oldValue,
        String newValue
) {
}
