package com.eqms.config;

/**
 * Maps legacy {@link WorkflowPoolTypes} pool codes to their equivalent
 * {@code workflow_roles} catalog codes (see docs/SECURITY_AUTHORIZATION_IMPLEMENTATION_PLAN.md
 * 0.5a). Used everywhere a DOCUMENT_WORKFLOW_POOL actor check needs to OR the
 * legacy document_workflow_pool_members lookup with the new Access Profile +
 * Workflow Role catalog lookup during the migration window.
 */
public final class WorkflowPoolMapping {

    private WorkflowPoolMapping() {}

    public static String toWorkflowRoleCode(String poolType) {
        if (poolType == null) {
            return null;
        }
        return switch (poolType.trim().toUpperCase(java.util.Locale.ROOT)) {
            case "DCO" -> "DCO";
            case "REVIEWER" -> "DOCUMENT_REVIEWER";
            case "APPROVER" -> "DOCUMENT_APPROVER";
            default -> null;
        };
    }
}
