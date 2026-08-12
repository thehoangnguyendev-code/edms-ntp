package com.eqms.dto.document;

import java.util.List;

public record DocumentAuditTrailResponse(
        String id,
        String timestamp,
        DocumentAuditTrailUserResponse user,
        String action,
        String actionType,
        List<DocumentAuditTrailChangeResponse> changes,
        String reason,
        String ipAddress,
        String device
) {
}
