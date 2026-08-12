package com.eqms.dto.audittrail;

import java.util.List;
import java.util.Map;

public record AuditTrailRecordResponse(
        String id,
        String timestamp,
        AuditTrailUserResponse user,
        String module,
        String action,
        String entityId,
        String entityName,
        String entityLabel,
        String objectCode,
        String description,
        String changeSummary,
        List<AuditTrailChangeResponse> changes,
        String reason,
        String ipAddress,
        String device,
        String userAgent,
        String signatureId,
        boolean electronicSignatureApplied,
        String severity,
        Double progressDurationSeconds,
        Map<String, Object> metadata
) {
}
