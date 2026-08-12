package com.eqms.config;

/**
 * Canonical document workflow pool type codes stored in
 * document_workflow_pool_members.pool_type. Use these constants instead of
 * raw string literals (RBAC master plan — no scattered role hardcodes).
 */
public final class WorkflowPoolTypes {

    public static final String DCO = "DCO";
    public static final String REVIEWER = "REVIEWER";
    public static final String APPROVER = "APPROVER";

    private WorkflowPoolTypes() {}
}
