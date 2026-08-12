package com.eqms.dto.audittrail;

public record AuditTrailChangeResponse(
        String field,
        String oldValue,
        String newValue
) {
}
