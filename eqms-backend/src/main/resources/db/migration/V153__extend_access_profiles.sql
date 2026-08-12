-- V153: Extend Access Profiles (roles) to support the new RBAC model
-- Access Profiles are Business Roles composed of Permission Sets, Workflow Roles,
-- Object Access Rules, and assigned Users — not direct permission assignments.

-- ── Extend roles table ────────────────────────────────────────────────────────
ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS business_unit_scope TEXT,
    ADD COLUMN IF NOT EXISTS department_scope TEXT,
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'CUSTOM'
        CHECK (type IN ('SYSTEM', 'CUSTOM'));

-- Sync type with is_system flag for existing rows
UPDATE roles SET type = CASE WHEN is_system THEN 'SYSTEM' ELSE 'CUSTOM' END;

-- ── Access Profile ↔ Permission Set ──────────────────────────────────────────
CREATE TABLE access_profile_permission_sets (
    access_profile_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_set_id UUID NOT NULL REFERENCES permission_sets(id) ON DELETE CASCADE,
    assigned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by       UUID REFERENCES app_users(id) ON DELETE SET NULL,
    PRIMARY KEY (access_profile_id, permission_set_id)
);

CREATE INDEX idx_apps_profile ON access_profile_permission_sets(access_profile_id);
CREATE INDEX idx_apps_set     ON access_profile_permission_sets(permission_set_id);

-- ── Access Profile ↔ Workflow Role ────────────────────────────────────────────
-- workflow_role values: DOCUMENT_AUTHOR, DOCUMENT_REVIEWER, DOCUMENT_APPROVER,
--   DOCUMENT_PUBLISHER, DCO, TRAINING_REVIEWER, TRAINING_APPROVER, QUALITY_ADMIN
CREATE TABLE access_profile_workflow_roles (
    access_profile_id UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    workflow_role      VARCHAR(80) NOT NULL,
    assigned_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by        UUID REFERENCES app_users(id) ON DELETE SET NULL,
    PRIMARY KEY (access_profile_id, workflow_role)
);

CREATE INDEX idx_apwr_profile ON access_profile_workflow_roles(access_profile_id);

-- ── Access Profile ↔ Object Access Rule ──────────────────────────────────────
CREATE TABLE access_profile_object_rules (
    access_profile_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    object_access_rule_id UUID NOT NULL REFERENCES object_access_rules(id) ON DELETE CASCADE,
    PRIMARY KEY (access_profile_id, object_access_rule_id)
);

CREATE INDEX idx_apor_profile ON access_profile_object_rules(access_profile_id);
CREATE INDEX idx_apor_rule    ON access_profile_object_rules(object_access_rule_id);

-- ── User ↔ Access Profile (many-to-many supplement) ──────────────────────────
-- Supplements existing app_users.role_id (single primary role) with multi-profile support
CREATE TABLE user_access_profiles (
    user_id           UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    access_profile_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by       UUID REFERENCES app_users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, access_profile_id)
);

CREATE INDEX idx_uap_user    ON user_access_profiles(user_id);
CREATE INDEX idx_uap_profile ON user_access_profiles(access_profile_id);

-- No backfill: app_users uses role_name (string), not a FK to roles
