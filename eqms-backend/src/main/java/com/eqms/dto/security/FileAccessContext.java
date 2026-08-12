package com.eqms.dto.security;

import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.ControlledCopyRecord;

import java.util.HashMap;
import java.util.Map;

/**
 * Carries workflow state and object attributes needed for file-access business rule evaluation.
 * Populated by the calling service before invoking SecureFileAccessService.
 */
public record FileAccessContext(
        String module,
        String workflowState,
        String fileType,
        String storageProvider,
        Map<String, Object> attributes
) {

    public static FileAccessContext empty() {
        return new FileAccessContext(null, null, null, null, Map.of());
    }

    public static FileAccessContext simple(String module, String workflowState) {
        return new FileAccessContext(module, workflowState, null, null, Map.of());
    }

    /** Build a context from a DocumentRevisionRecord. */
    public static FileAccessContext ofRevision(DocumentRevisionRecord revision) {
        if (revision == null) return empty();
        Map<String, Object> attrs = new HashMap<>();
        attrs.put("sourceLocked", revision.isSourceLocked());
        attrs.put("editingStatus", revision.getEditingStatus());
        attrs.put("hasRejectedReviewSnapshot", revision.getRejectedAt() != null
                && revision.getPreviewFilePath() != null
                && !revision.getPreviewFilePath().isBlank());
        if (revision.getId() != null) {
            attrs.put("revisionId", revision.getId().toString());
        }
        if (revision.getAuthor() != null && revision.getAuthor().getId() != null) {
            attrs.put("authorId", revision.getAuthor().getId().toString());
        }
        if (revision.getBusinessUnit() != null && revision.getBusinessUnit().getId() != null) {
            attrs.put("businessUnitId", revision.getBusinessUnit().getId().toString());
        }
        if (revision.getDepartment() != null && revision.getDepartment().getId() != null) {
            attrs.put("departmentId", revision.getDepartment().getId().toString());
        }
        if (revision.getStatus() != null) {
            attrs.put("statusCode", revision.getStatus().getCode());
        }
        return new FileAccessContext(
                "DOCUMENTS",
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                null,
                revision.getStorageProvider(),
                attrs
        );
    }

    /** Build a context from a ControlledCopyRecord with policy info. */
    public static FileAccessContext ofControlledCopy(
            ControlledCopyRecord copy,
            boolean policyAllowsDownload,
            boolean policyAllowsPortalView
    ) {
        if (copy == null) return empty();
        Map<String, Object> attrs = new HashMap<>();
        attrs.put("policyAllowsDownload", policyAllowsDownload);
        attrs.put("policyAllowsPortalView", policyAllowsPortalView);
        attrs.put("statusCode", copy.getStatusCode());
        attrs.put("obsoleteReason", copy.getObsoleteReason());
        boolean isActive = "DISTRIBUTED".equalsIgnoreCase(copy.getStatusCode())
                || "READY_FOR_DISTRIBUTION".equalsIgnoreCase(copy.getStatusCode());
        attrs.put("isActive", isActive);
        return new FileAccessContext(
                "CONTROLLED_COPY",
                copy.getStatusCode(),
                null,
                null,
                attrs
        );
    }

    // ── Attribute helpers ─────────────────────────────────────────────────────

    public boolean getBool(String key, boolean defaultVal) {
        Object val = attributes == null ? null : attributes.get(key);
        if (val instanceof Boolean b) return b;
        return defaultVal;
    }

    public String getString(String key) {
        Object val = attributes == null ? null : attributes.get(key);
        return val == null ? null : val.toString();
    }

    public java.util.UUID getUUID(String key) {
        String s = getString(key);
        if (s == null || s.isBlank()) return null;
        try { return java.util.UUID.fromString(s); } catch (IllegalArgumentException e) { return null; }
    }
}
