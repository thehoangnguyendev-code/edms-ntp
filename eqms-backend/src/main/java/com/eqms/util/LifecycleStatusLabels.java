package com.eqms.util;

import java.util.Map;
import java.util.Set;

/**
 * Human-readable labels for lifecycle status codes referenced by workflow/lifecycle policies,
 * computed server-side so the Permission Catalog / permission-picker / Access Profile drawer can
 * show "applies at which lifecycle state" hints without the frontend formatting raw status codes.
 * Deliberately separate from the private {@code Labels} helper inside WorkflowActionPolicyService
 * to avoid widening that class's visibility just for this display-only feature.
 */
public final class LifecycleStatusLabels {

    // Explicit overrides only for codes that need punctuation/wording the generic title-caser
    // (below) can't produce on its own. Any status code NOT listed here still gets a readable
    // label via titleCase() -- the fallback is never the raw code, so a status added by a future
    // migration without an update here degrades gracefully instead of showing e.g. "READY_FOR_DISTRIBUTION".
    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry("CLOSED_CANCELLED", "Closed / Cancelled")
    );

    private static final Map<String, String> OBJECT_TYPE_LABELS = Map.of(
            "DOCUMENT_REVISION", "Revision",
            "REVISION", "Revision"
    );

    // Small connective words stay lowercase in title case, unless they're the first word.
    private static final Set<String> LOWERCASE_WORDS = Set.of("for", "of", "and", "or", "in", "on", "to", "the");

    private LifecycleStatusLabels() {
    }

    /** Human-readable label for a lifecycle status code (e.g. "READY_FOR_DISTRIBUTION" -> "Ready for Distribution"). */
    public static String label(String statusCode) {
        if (statusCode == null || statusCode.isBlank()) {
            return null;
        }
        return LABELS.getOrDefault(statusCode, titleCase(statusCode));
    }

    /** Human-readable label for a policy's objectType (e.g. "CONTROLLED_COPY_BATCH" -> "Controlled Copy Batch"). */
    public static String objectTypeLabel(String objectType) {
        if (objectType == null || objectType.isBlank()) {
            return objectType;
        }
        return OBJECT_TYPE_LABELS.getOrDefault(objectType, titleCase(objectType));
    }

    /**
     * Human-readable label for a policy's action/capability code (e.g. "REJECT_REVIEW" ->
     * "Reject Review", "PRINT_COPY" -> "Print Copy"). Both {@code workflow_action_policies.action_code}
     * and {@code lifecycle_state_policies.capability_code} are seeded as UPPER_SNAKE_CASE English
     * phrases, so generic title-casing (no lookup table needed) already reads correctly.
     */
    public static String actionLabel(String actionOrCapabilityCode) {
        if (actionOrCapabilityCode == null || actionOrCapabilityCode.isBlank()) {
            return actionOrCapabilityCode;
        }
        return titleCase(actionOrCapabilityCode);
    }

    private static String titleCase(String code) {
        String[] words = code.split("_");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            String word = words[i];
            if (word.isEmpty()) continue;
            if (sb.length() > 0) sb.append(' ');
            String lower = word.toLowerCase();
            if (i > 0 && LOWERCASE_WORDS.contains(lower)) {
                sb.append(lower);
            } else {
                sb.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1).toLowerCase());
            }
        }
        return sb.toString();
    }
}
