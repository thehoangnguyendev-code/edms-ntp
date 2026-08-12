package com.eqms.dto.security;

import com.eqms.entity.DocumentRevisionRecord;

import java.util.HashMap;
import java.util.Map;

/**
 * Carries the workflow state of a revision for authorization evaluation.
 * Build with {@link #of(DocumentRevisionRecord)} before calling RevisionWorkflowAuthorizationService.
 */
public record RevisionWorkflowAuthorizationContext(
        String module,
        String workflow,
        String currentState,
        String targetState,
        boolean eSignatureRequired,
        boolean snapshotRequired,
        Map<String, Object> attributes
) {
    public static RevisionWorkflowAuthorizationContext empty() {
        return new RevisionWorkflowAuthorizationContext(
                null, null, null, null, false, false, Map.of()
        );
    }

    public static RevisionWorkflowAuthorizationContext of(DocumentRevisionRecord revision) {
        if (revision == null) return empty();
        Map<String, Object> attrs = new HashMap<>();
        attrs.put("editingStatus", revision.getEditingStatus());
        attrs.put("sourceLocked", revision.isSourceLocked());
        attrs.put("snapshotStatus", revision.getSnapshotStatus());
        attrs.put("requiresTraining", revision.isRequiresTraining());
        if (revision.getAuthor() != null && revision.getAuthor().getId() != null) {
            attrs.put("authorId", revision.getAuthor().getId().toString());
        }
        String currentState = revision.getStatus() == null ? null : revision.getStatus().getCode();
        return new RevisionWorkflowAuthorizationContext(
                "DOCUMENTS",
                "REVISION_LIFECYCLE",
                currentState,
                null,
                false,
                false,
                attrs
        );
    }

    public boolean getBool(String key, boolean defaultVal) {
        Object val = attributes == null ? null : attributes.get(key);
        if (val instanceof Boolean b) return b;
        return defaultVal;
    }

    public String getString(String key) {
        Object val = attributes == null ? null : attributes.get(key);
        return val == null ? null : val.toString();
    }
}
