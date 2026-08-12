package com.eqms.dto.audittrail;

import java.util.List;
import java.util.Map;

public record AuditTrailDetailResponse(
        String id,
        String timestamp,
        String createdAt,
        String updatedAt,
        AuditTrailUserResponse user,
        String username,
        String module,
        String action,
        String actionType,
        String entityId,
        String entityType,
        String entityName,
        String entityLabel,
        String objectCode,
        String documentNumber,
        String revisionNumber,
        String entityStatus,
        String description,
        String changeSummary,
        List<AuditTrailChangeResponse> changes,
        String reason,
        String fromStatus,
        String toStatus,
        String oldValue,
        String newValue,
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
