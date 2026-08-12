-- V151: Object Access Rules — role-scoped access control on document categories / types
-- Enables fine-grained GMP control: e.g., "QA team can only access SOPs, not Batch Records".
-- Rules are evaluated AFTER role-based permissions: DENY always wins over ALLOW.

CREATE TABLE object_access_rules (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(200) NOT NULL,
    description   TEXT,

    -- Scope: which roles this rule applies to (NULL = applies to ALL roles)
    role_id       UUID         REFERENCES roles(id) ON DELETE CASCADE,

    -- Resource type being controlled
    resource_type VARCHAR(50)  NOT NULL
        CHECK (resource_type IN ('DOCUMENT_CATEGORY', 'DOCUMENT_TYPE', 'DOCUMENT_STATUS')),

    -- Specific resource instance (NULL = rule applies to ALL instances of resource_type)
    resource_id   UUID,
    resource_name VARCHAR(200),  -- denormalized label for display

    -- Which document actions this rule controls
    actions       TEXT[]       NOT NULL DEFAULT '{}',
    -- e.g.: ['VIEW','CREATE','EDIT','SUBMIT','REVIEW','APPROVE','PUBLISH','DELETE']

    -- Rule effect
    effect        VARCHAR(10)  NOT NULL DEFAULT 'ALLOW'
        CHECK (effect IN ('ALLOW', 'DENY')),

    -- Evaluation priority — higher number wins when multiple rules match
    priority      INTEGER      NOT NULL DEFAULT 0,

    active        BOOLEAN      NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by    UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    updated_by    UUID         REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_oar_role          ON object_access_rules(role_id);
CREATE INDEX idx_oar_resource_type ON object_access_rules(resource_type);
CREATE INDEX idx_oar_resource_id   ON object_access_rules(resource_id);
CREATE INDEX idx_oar_active        ON object_access_rules(active);
