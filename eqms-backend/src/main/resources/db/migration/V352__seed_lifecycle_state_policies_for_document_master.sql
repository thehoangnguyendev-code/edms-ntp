-- Bug found while building the Phase 1-2 Document Master authorization adapter
-- (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md): DocumentMasterWorkflowAuthorizationService
-- (the REAL enforcement path for Document Master CANCEL/OBSOLETE -- see
-- DocumentService.java:1197,1229 -> DocumentAuthorizationService.requireDocumentMasterLifecycleAction
-- -> DocumentMasterWorkflowAuthorizationService.check()) resolves policy exclusively from
-- `lifecycle_state_policies`, NOT `workflow_action_policies`. Verified against the running
-- database: `lifecycle_state_policies` had ZERO rows for object_type = 'DOCUMENT' (active or
-- not) -- `check()` returns WORKFLOW_POLICY_NOT_CONFIGURED (deny) unconditionally for every user,
-- with no fallback. Document Master Cancel/Obsolete has therefore been unusable for anyone.
--
-- This is unrelated to the authorization architecture refactor itself -- a pre-existing data gap
-- (a `workflow_action_policies` row for DOCUMENT/CANCEL and DOCUMENT/OBSOLETE was seeded at some
-- point, but that table is not what this specific code path reads). Fixed here by seeding the
-- table that is actually consulted, using the SAME required_permission_code already used by the
-- (unconsulted) workflow_action_policies rows for these two actions, to avoid inventing a third
-- source of truth for who is allowed to Cancel/Obsolete a Document.
--
-- actor_scope = ANY (LifecycleActorScope has no CO_AUTHOR option; Document Master has no
-- workflow-participant concept per LifecycleCapability's own class comment) -- gated purely by
-- required_permission_code, matching the existing workflow_action_policies actor
-- (PERMISSION:documents.workspace.manage) for both actions.
--
-- Rollback (if needed):
--   DELETE FROM lifecycle_state_policies WHERE module_key = 'documents' AND object_type = 'DOCUMENT'
--     AND capability_code IN ('CANCEL', 'OBSOLETE') AND is_system = true;

INSERT INTO lifecycle_state_policies (
    module_key, object_type, capability_code, status_code, actor_scope,
    required_permission_code, priority, active, is_system, description
) VALUES
    ('documents', 'DOCUMENT', 'CANCEL', 'DRAFT', 'ANY',
        'documents.document.cancel', 100, true, true,
        'System default: a user granted document cancel may cancel a Draft Document Master.'),
    ('documents', 'DOCUMENT', 'OBSOLETE', 'ACTIVE', 'ANY',
        'documents.workspace.manage', 100, true, true,
        'System default: a user granted document workspace management may obsolete an Active Document Master.');
