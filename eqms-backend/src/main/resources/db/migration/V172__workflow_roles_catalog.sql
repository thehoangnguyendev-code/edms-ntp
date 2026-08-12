-- V172: Workflow Roles catalog — merges the two hardcoded enums (WorkflowRoleCode,
-- WorkflowPoolTypes) into one extensible, DB-backed catalog. See
-- docs/SECURITY_AUTHORIZATION_IMPLEMENTATION_PLAN.md section 0.5a.
--
-- Both legacy Java types (WorkflowRoleCode, WorkflowPoolTypes) and their backing
-- tables (access_profile_workflow_roles, document_workflow_pool_members) are kept
-- in place for now — this migration only adds the new catalog table and performs
-- a best-effort data migration of existing pool members into the Access Profile
-- + Workflow Role model, so the new DCO-bypass query path has correct data.

CREATE TABLE workflow_roles (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code          VARCHAR(80)  UNIQUE NOT NULL,
    label         VARCHAR(200) NOT NULL,
    module_key    VARCHAR(80)  NOT NULL,
    description   TEXT,
    display_order INT          NOT NULL DEFAULT 100,
    active        BOOLEAN      NOT NULL DEFAULT true,
    is_system     BOOLEAN      NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by    UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    updated_by    UUID         REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_workflow_roles_module ON workflow_roles(module_key);
CREATE INDEX idx_workflow_roles_active ON workflow_roles(active);

-- ── Seed: 8 WorkflowRoleCode values + 3 WorkflowPoolTypes values, DCO deduplicated ──
-- (9 rows total, not 11)
INSERT INTO workflow_roles (code, label, module_key, description, display_order, is_system) VALUES
    ('DOCUMENT_AUTHOR',    'Document Author',    'documents', 'Author of a document revision.', 10, true),
    ('DOCUMENT_REVIEWER',  'Document Reviewer',  'documents', 'Reviews submitted document revisions.', 20, true),
    ('DOCUMENT_APPROVER',  'Document Approver',  'documents', 'Approves document revisions.', 30, true),
    ('DOCUMENT_PUBLISHER', 'Document Publisher', 'documents', 'Publishes approved document revisions.', 40, true),
    ('DCO',                'DCO',                'documents', 'Document Control Officer — full document visibility / control.', 50, true),
    ('TRAINING_REVIEWER',  'Training Reviewer',  'training',  'Reviews training course content.', 60, true),
    ('TRAINING_APPROVER',  'Training Approver',  'training',  'Approves training course content.', 70, true),
    ('QUALITY_ADMIN',      'Quality Admin',      'quality',   'Full quality administration workflow role.', 80, true);

-- ── Data migration: document_workflow_pool_members -> access_profile_workflow_roles ──
-- Maps pool_type -> workflow role code: DCO -> DCO, REVIEWER -> DOCUMENT_REVIEWER,
-- APPROVER -> DOCUMENT_APPROVER. For each active pool member user without a
-- suitable existing Access Profile / Workflow Role assignment, create an
-- auto-generated "Migrated <PoolType> Access" access profile, link the user to
-- it via user_access_profiles, and assign the mapped workflow role to that
-- profile via access_profile_workflow_roles.

DO $$
DECLARE
    pool_member RECORD;
    mapped_role VARCHAR(80);
    migrated_profile_id UUID;
    migrated_profile_name VARCHAR(200);
    migrated_profile_code VARCHAR(100);
BEGIN
    FOR pool_member IN
        SELECT DISTINCT dwpm.user_id, dwpm.pool_type
        FROM document_workflow_pool_members dwpm
        WHERE dwpm.is_active = true
    LOOP
        mapped_role := CASE pool_member.pool_type
            WHEN 'DCO' THEN 'DCO'
            WHEN 'REVIEWER' THEN 'DOCUMENT_REVIEWER'
            WHEN 'APPROVER' THEN 'DOCUMENT_APPROVER'
            ELSE NULL
        END;

        IF mapped_role IS NULL THEN
            CONTINUE;
        END IF;

        -- Already covered by an existing Access Profile assignment for this role? Skip.
        IF EXISTS (
            SELECT 1
            FROM user_access_profiles uap
            JOIN access_profile_workflow_roles apwr ON apwr.access_profile_id = uap.access_profile_id
            WHERE uap.user_id = pool_member.user_id
              AND apwr.workflow_role = mapped_role
        ) THEN
            CONTINUE;
        END IF;

        migrated_profile_name := 'Migrated ' || pool_member.pool_type || ' Access';
        migrated_profile_code := 'MIGRATED_' || pool_member.pool_type || '_ACCESS';

        SELECT id INTO migrated_profile_id FROM roles WHERE code = migrated_profile_code;
        IF migrated_profile_id IS NULL THEN
            INSERT INTO roles (id, name, code, description, is_system, is_active, type, created_at, updated_at)
            VALUES (
                gen_random_uuid(),
                migrated_profile_name,
                migrated_profile_code,
                'Auto-generated during V172 migration to carry forward document_workflow_pool_members (' || pool_member.pool_type || ') assignments into the Access Profile + Workflow Role model.',
                false,
                true,
                'CUSTOM',
                now(),
                now()
            )
            RETURNING id INTO migrated_profile_id;
        END IF;

        INSERT INTO access_profile_workflow_roles (access_profile_id, workflow_role)
        VALUES (migrated_profile_id, mapped_role)
        ON CONFLICT (access_profile_id, workflow_role) DO NOTHING;

        INSERT INTO user_access_profiles (user_id, access_profile_id)
        VALUES (pool_member.user_id, migrated_profile_id)
        ON CONFLICT (user_id, access_profile_id) DO NOTHING;
    END LOOP;
END $$;
