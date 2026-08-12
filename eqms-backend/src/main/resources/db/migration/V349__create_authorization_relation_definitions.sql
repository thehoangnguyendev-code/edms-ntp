-- Phase 0.3 of SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md (SS3.1): relation definitions are
-- DATA, not a fixed Java enum. Admin can create/rename a relation_code (e.g. "DOCUMENT_STEWARD")
-- as long as it uses one of the server-owned resolvers below -- the resolver itself is never
-- admin-authorable (no SQL/JS/SpEL), only its configuration (e.g. participantType=AUTHOR).
--
-- This migration is purely additive: it creates the new table and seeds relation definitions
-- that mirror today's live WorkflowActorType selectors, so the upcoming AuthorizationEngine
-- (Phase 0.5) has real data to read from Day 1. It does NOT touch workflow_action_policy_actors
-- or any enforcement path -- those still run on WorkflowActorType until each module's shadow ->
-- flag cutover (Phase 1-2 onward) actually switches evaluators.
--
-- Rollback (if needed):
--   DROP TABLE authorization_relation_definitions;

CREATE TABLE authorization_relation_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(80)  NOT NULL,
    display_name    VARCHAR(160) NOT NULL,
    resource_type   VARCHAR(80)  NOT NULL,
    resolver_code   VARCHAR(80)  NOT NULL,
    resolver_config JSONB        NOT NULL DEFAULT '{}'::jsonb,
    description     VARCHAR(500),
    active          BOOLEAN      NOT NULL DEFAULT true,
    version         BIGINT       NOT NULL DEFAULT 1,
    created_by      UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by      UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (code, resource_type),
    -- Server-owned resolver catalog (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md SS3.1).
    -- Admin cannot insert a resolver_code outside this list; new resolvers require a developer
    -- migration + resolver implementation + GMP test, never a runtime/admin-authored expression.
    CONSTRAINT authorization_relation_definitions_resolver_code_check
        CHECK (resolver_code IN (
            'SELF_RESOLVER',
            'RESOURCE_OWNER',
            'WORKFLOW_PARTICIPANT',
            'CONTROLLED_COPY_RECIPIENT',
            'ORGANIZATION_SCOPE',
            'OBJECT_GRANT'
        ))
);

CREATE INDEX idx_authorization_relation_definitions_resource_type
    ON authorization_relation_definitions (resource_type, active);

-- Seed relation definitions mirroring today's live WorkflowActorType selectors, so the future
-- engine's WORKFLOW_PARTICIPANT/RESOURCE_OWNER/CONTROLLED_COPY_RECIPIENT resolvers have real
-- rows to read once wired in. participantType values match RevisionWorkflowParticipant's
-- existing participant_type strings (AUTHOR, CO_AUTHOR, REVIEWER, APPROVER).
INSERT INTO authorization_relation_definitions
    (code, display_name, resource_type, resolver_code, resolver_config, description)
VALUES
    ('AUTHOR', 'Author', 'REVISION', 'WORKFLOW_PARTICIPANT',
        '{"participantType": "AUTHOR"}'::jsonb,
        'The assigned Author of the revision.'),
    ('CO_AUTHOR', 'Co-Author', 'REVISION', 'WORKFLOW_PARTICIPANT',
        '{"participantType": "CO_AUTHOR"}'::jsonb,
        'An assigned Co-Author of the revision.'),
    ('ASSIGNED_REVIEWER', 'Assigned Reviewer', 'REVISION', 'WORKFLOW_PARTICIPANT',
        '{"participantType": "REVIEWER"}'::jsonb,
        'A reviewer assigned to the revision, pending and next in sequence.'),
    ('ASSIGNED_APPROVER', 'Assigned Approver', 'REVISION', 'WORKFLOW_PARTICIPANT',
        '{"participantType": "APPROVER"}'::jsonb,
        'An approver assigned to the revision, pending and next in sequence.'),
    ('OWNER', 'Owner', 'DOCUMENT', 'RESOURCE_OWNER', '{}'::jsonb,
        'The creator/owner of the Document Master.'),
    ('RECIPIENT', 'Recipient', 'CONTROLLED_COPY', 'CONTROLLED_COPY_RECIPIENT',
        '{"recipientKind": "ANY"}'::jsonb,
        'The internal or external recipient of this specific Controlled Copy record.');
