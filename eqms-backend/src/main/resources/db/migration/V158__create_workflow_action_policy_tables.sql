-- V158: Configurable Workflow Action Policy tables (Sprint 4)

CREATE TABLE IF NOT EXISTS workflow_action_policies (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_key              VARCHAR(80)  NOT NULL,
    workflow_key            VARCHAR(80)  NOT NULL,
    object_type             VARCHAR(80)  NOT NULL,
    action_code             VARCHAR(120) NOT NULL,
    from_status             VARCHAR(80)  NOT NULL,
    document_type_id        UUID         NULL,
    required_permission_code VARCHAR(160) NOT NULL,
    priority                INT          NOT NULL DEFAULT 100,
    active                  BOOLEAN      NOT NULL DEFAULT TRUE,
    is_system               BOOLEAN      NOT NULL DEFAULT FALSE,
    description             TEXT         NULL,
    created_by              UUID         NULL,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by              UUID         NULL,
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wap_lookup
    ON workflow_action_policies (module_key, workflow_key, object_type, action_code, from_status, active);

CREATE INDEX IF NOT EXISTS idx_wap_document_type
    ON workflow_action_policies (document_type_id)
    WHERE document_type_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wap_priority
    ON workflow_action_policies (priority, updated_at DESC);

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_action_policy_actors (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id   UUID        NOT NULL REFERENCES workflow_action_policies(id) ON DELETE CASCADE,
    actor_type  VARCHAR(80) NOT NULL,
    actor_code  VARCHAR(160) NULL,
    created_by  UUID         NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wapa_policy
    ON workflow_action_policy_actors (policy_id);

-- Unique guard: prevent duplicate actor_type+actor_code per policy.
-- NULL actor_code is treated as distinct per actor_type (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS idx_wapa_unique_typed
    ON workflow_action_policy_actors (policy_id, actor_type)
    WHERE actor_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wapa_unique_coded
    ON workflow_action_policy_actors (policy_id, actor_type, actor_code)
    WHERE actor_code IS NOT NULL;
