package com.eqms.enums;

/**
 * Fixed, server-owned catalog of relation resolvers (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md
 * §3.1). Admin can create/rename/version an {@code authorization_relation_definitions} row that
 * uses one of these resolvers with a resolver-specific config (e.g. {@code participantType}),
 * but can never author a new resolver — that requires a developer migration, implementation and
 * GMP test. Keep this enum's values in exact sync with the DB CHECK constraint in
 * V349__create_authorization_relation_definitions.sql (extended by V353 for the two resolvers
 * added below).
 */
public enum RelationResolverCode {
    /** Actor is the resource itself / the user acting on their own record (e.g. own Preferences). */
    SELF_RESOLVER,
    /** Actor is the creator/owner of the resource. */
    RESOURCE_OWNER,
    /** Participant assignment on the resource — config: {@code participantType} (e.g. AUTHOR, REVIEWER). */
    WORKFLOW_PARTICIPANT,
    /** Internal or external recipient of a Controlled Copy record — config: {@code recipientKind}. */
    CONTROLLED_COPY_RECIPIENT,
    /** Business Unit/Department/hierarchy scope from Access Profile or Object Rule — config: {@code scopeType}. */
    ORGANIZATION_SCOPE,
    /** Explicit Allow/Deny object-level grant. */
    OBJECT_GRANT,
    /**
     * Actor holds a specific permission — config: {@code permissionCode}. Resource-agnostic (does
     * not depend on resource state), so resolved centrally by AuthorizationEngineService rather
     * than a per-resource adapter. Mirrors the legacy {@code WorkflowActionPolicyActor} PERMISSION
     * actor type.
     */
    PERMISSION_RESOLVER,
    /**
     * Actor is a member of a specific Access Profile — config: {@code profileCode}. Resource-agnostic,
     * resolved centrally like {@link #PERMISSION_RESOLVER}. Mirrors the legacy
     * {@code WorkflowActionPolicyActor} ACCESS_PROFILE actor type.
     */
    ACCESS_PROFILE_RESOLVER
}
