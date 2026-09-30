-- V503: Replace the single per-Document-Type "allow_uncontrolled_copy" flag (V498) with a 2-layer
-- Uncontrolled Copy eligibility model:
--   Layer 1: a rule matrix (Document Type x Confidentiality Level, NULL = "Any"), most-specific-wins,
--            with one fixed system catch-all row (both NULL) that cannot be deleted.
--   Layer 2: an optional per-document override (ALLOW / BLOCK, NULL = inherit from the matrix),
--            changed only with a reason + e-signature (audited by the application).
-- Default posture is deny: the seeded catch-all row has allowed = false, the same spirit as the
-- removed flag's default of false. Administrators opt document types in with specific rules.
--
-- Table/column names cross-checked against existing migrations: document_types (V5, V498),
-- documents / app_users (V496), permissions columns (V3, V36, V499), permission_set_items (V428,
-- V499), permission_dependencies (V403, V429). role_permissions is NOT referenced (dropped by V436).

-- 1. Remove the old mechanism (no compatibility shim).
ALTER TABLE document_types DROP COLUMN IF EXISTS allow_uncontrolled_copy;

-- 2. Confidentiality Levels dictionary (classification only -- no allow/block flag lives here).
CREATE TABLE confidentiality_levels (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(120) NOT NULL UNIQUE,
    description   VARCHAR(512),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Document classification + per-document override.
ALTER TABLE documents
    ADD COLUMN confidentiality_level_id UUID REFERENCES confidentiality_levels(id),
    ADD COLUMN uncontrolled_copy_override VARCHAR(10)
        CHECK (uncontrolled_copy_override IS NULL OR uncontrolled_copy_override IN ('ALLOW', 'BLOCK')),
    ADD COLUMN uncontrolled_copy_override_reason TEXT,
    ADD COLUMN uncontrolled_copy_override_by_user_id UUID REFERENCES app_users(id),
    ADD COLUMN uncontrolled_copy_override_at TIMESTAMPTZ;

CREATE INDEX idx_documents_confidentiality_level ON documents(confidentiality_level_id);

-- 4. Eligibility rule matrix.
CREATE TABLE uncontrolled_copy_eligibility_rules (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version                  BIGINT NOT NULL DEFAULT 0,
    document_type_id         UUID REFERENCES document_types(id),
    confidentiality_level_id UUID REFERENCES confidentiality_levels(id),
    allowed                  BOOLEAN NOT NULL,
    active                   BOOLEAN NOT NULL DEFAULT TRUE,
    system                   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by               UUID REFERENCES app_users(id) ON DELETE SET NULL,
    updated_by               UUID REFERENCES app_users(id) ON DELETE SET NULL,
    -- Only the global catch-all (Any x Any) may be a system row.
    CONSTRAINT ck_uc_eligibility_system_is_catch_all
        CHECK (NOT system OR (document_type_id IS NULL AND confidentiality_level_id IS NULL))
);

-- At most one ACTIVE rule per (Document Type, Confidentiality Level) pair, NULL ("Any") included:
-- NULLs are distinct in a plain unique index, so they are mapped to a fixed sentinel UUID here.
CREATE UNIQUE INDEX ux_uc_eligibility_rules_active_pair
    ON uncontrolled_copy_eligibility_rules (
        COALESCE(document_type_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(confidentiality_level_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE active;

CREATE INDEX idx_uc_eligibility_rules_document_type ON uncontrolled_copy_eligibility_rules(document_type_id);
CREATE INDEX idx_uc_eligibility_rules_confidentiality ON uncontrolled_copy_eligibility_rules(confidentiality_level_id);

-- 5. Seed the single system catch-all row: default deny.
INSERT INTO uncontrolled_copy_eligibility_rules (document_type_id, confidentiality_level_id, allowed, active, system)
SELECT NULL, NULL, FALSE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM uncontrolled_copy_eligibility_rules WHERE system);

-- 6. New permissions.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'settings.confidentiality_level.view', 'View Confidentiality Levels',
     'Application Settings', 'app-settings', 'confidentiality_levels',
     'View Confidentiality Level master data.', 1917, FALSE),
    (gen_random_uuid(), 'settings.confidentiality_level.manage', 'Manage Confidentiality Levels',
     'Application Settings', 'app-settings', 'confidentiality_levels',
     'Create, update, and delete Confidentiality Level master data.', 1918, TRUE),
    (gen_random_uuid(), 'documents.document.manage_uncontrolled_copy_eligibility', 'Manage Uncontrolled Copy Eligibility Override',
     'Document Master', 'documents', 'document_master',
     'Set or clear the per-document Uncontrolled Copy eligibility override (Always Allow / Always Block).', 631, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Confidentiality Level grants mirror whoever already holds the Retention Policy equivalent
-- ("expand, never revoke", same shape as V428/V499).
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), legacy.permission_set_id, target.id
FROM permission_set_items legacy
JOIN permissions old_permission ON old_permission.id = legacy.permission_id
JOIN permissions target ON target.code = REPLACE(old_permission.code, 'settings.retention_policy.', 'settings.confidentiality_level.')
WHERE old_permission.code IN ('settings.retention_policy.view', 'settings.retention_policy.manage')
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- The per-document override is granted to whoever administers the Uncontrolled Copies Policy.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), legacy.permission_set_id, target.id
FROM permission_set_items legacy
JOIN permissions old_permission ON old_permission.id = legacy.permission_id
JOIN permissions target ON target.code = 'documents.document.manage_uncontrolled_copy_eligibility'
WHERE old_permission.code = 'documents.admin.uncontrolled_copies_policy.manage'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- Manage requires view of the same screen (same rule shape as V429 SET-10..SET-17 / V434 SET-18).
INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES
    ('settings.confidentiality_level.manage', 'settings.confidentiality_level.view', 'REQUIRES', 'SET-19',
     'Quản lý Confidentiality Levels cần xem được cùng resource.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;
