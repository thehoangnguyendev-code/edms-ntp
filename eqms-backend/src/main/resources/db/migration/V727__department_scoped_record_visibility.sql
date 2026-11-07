-- Department-scoped record visibility (owner decision 2026-11-02, Decision Log DEPT-VISIBILITY-2026-11-02).
--
-- 1. A user belongs to a Department by foreign key. The free-text app_users.department stays for display and for
--    the existing screens; the foreign key is what authorization uses, never the text.
-- 2. An Object Access Rule may belong to one Department ("owner"): the Department Head of that Department manages it,
--    and it can only ever grant VIEW of records of that Department.
-- 3. A rule may name individual users as grantees, besides Access Profiles.
-- 4. Two more rule targets: DEPARTMENT and BUSINESS_UNIT.
-- 5. One new permission, assigned through Access Profiles like every other: manage the rules of one's own Department.

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments (id);

CREATE INDEX IF NOT EXISTS idx_app_users_department_id ON app_users (department_id);

ALTER TABLE object_access_rules
    ADD COLUMN IF NOT EXISTS owner_department_id UUID REFERENCES departments (id);

CREATE INDEX IF NOT EXISTS idx_oar_owner_department ON object_access_rules (owner_department_id);

-- A Department-owned rule grants VIEW only, and is an ALLOW or DENY like any other rule.
ALTER TABLE object_access_rules
    ADD CONSTRAINT chk_oar_owner_department_view_only
    CHECK (owner_department_id IS NULL OR actions = ARRAY['VIEW']::text[]);

DO $$
DECLARE c RECORD;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'object_access_rules'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%DOCUMENT_CATEGORY%'
    LOOP
        EXECUTE format('ALTER TABLE object_access_rules DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE object_access_rules
    ADD CONSTRAINT chk_oar_resource_type
    CHECK (resource_type IN ('DOCUMENT_CATEGORY', 'DOCUMENT_TYPE', 'DOCUMENT_STATUS', 'DEPARTMENT', 'BUSINESS_UNIT'));

CREATE TABLE IF NOT EXISTS object_access_rule_users (
    object_access_rule_id UUID NOT NULL REFERENCES object_access_rules (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users (id),
    PRIMARY KEY (object_access_rule_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_oar_users_user ON object_access_rule_users (user_id);

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT '72111111-1111-1111-1111-111111111727'::uuid, 'security.object_rules.manage_own_department',
       'Manage Record Visibility of Own Department', 'Security & Authorization', 'security', 'object_rules',
       'As the Department Head named on a Department, decide which users see the documents, revisions and copies of that Department. Applies only to the Department the user heads; it never grants any other access.',
       727, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = 'security.object_rules.manage_own_department');

-- Backfill LAST: an UPDATE of app_users leaves pending trigger events that forbid any later DDL on that table.
-- Exact name match only (case and surrounding blanks ignored); departments.name is unique. Anyone who does not match
-- stays NULL and is listed by the verification query in the Decision Log -- nothing is guessed.
UPDATE app_users u
SET department_id = d.id
FROM departments d
WHERE u.department_id IS NULL
  AND u.department IS NOT NULL
  AND lower(btrim(u.department)) = lower(btrim(d.name));
