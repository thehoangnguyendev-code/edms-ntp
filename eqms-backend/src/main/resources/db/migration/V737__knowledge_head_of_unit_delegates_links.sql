-- Owner decisions 2026-11-04 (Decision Log KNOWLEDGE-SHARING-2026-11-03, follow-ups):
--  1. a Business Unit has a Head of Unit, who may share the whole Unit folder and everything inside it (the Department Head only his own Department);
--  2. a Head may name people who may share like he does ("delegates"); a delegate never excludes, never removes what a Head shared, and tells the Head
--     (e-mail + Audit Trail) every time;
--  3. a share can be a link: a person who opens it signed in gets the folder or the document the link points to until it expires or is revoked.

-- ---- 1. Head of Unit ------------------------------------------------------------------------------------------------
ALTER TABLE business_units ADD COLUMN IF NOT EXISTS head_of_unit_id UUID REFERENCES app_users (id);
CREATE INDEX IF NOT EXISTS idx_business_units_head_of_unit ON business_units (head_of_unit_id);

-- A share (a rule owned by a Department, V727) may also be owned by a Business Unit: the share of the whole Unit.
ALTER TABLE object_access_rules ADD COLUMN IF NOT EXISTS owner_business_unit_id UUID REFERENCES business_units (id);
CREATE INDEX IF NOT EXISTS idx_oar_owner_business_unit ON object_access_rules (owner_business_unit_id);

-- Who made the share, by authority at that time: ADMIN, UNIT_HEAD, DEPARTMENT_HEAD or DELEGATE. It decides who may remove it later
-- (nobody removes what a higher authority made). NULL on a share made before this column: treated as made by a Department Head.
ALTER TABLE object_access_rules ADD COLUMN IF NOT EXISTS created_authority VARCHAR(20);

ALTER TABLE object_access_rules
    ADD CONSTRAINT chk_oar_single_owner CHECK (owner_department_id IS NULL OR owner_business_unit_id IS NULL);

ALTER TABLE object_access_rules DROP CONSTRAINT IF EXISTS chk_oar_owner_department_view_only;
ALTER TABLE object_access_rules
    ADD CONSTRAINT chk_oar_owner_view_only
    CHECK ((owner_department_id IS NULL AND owner_business_unit_id IS NULL) OR actions = ARRAY['VIEW']::text[]);

ALTER TABLE object_access_rules DROP CONSTRAINT IF EXISTS chk_oar_whole_department_needs_owner;
ALTER TABLE object_access_rules
    ADD CONSTRAINT chk_oar_whole_department_needs_owner
    CHECK (grantee_whole_department = FALSE OR owner_department_id IS NOT NULL OR owner_business_unit_id IS NOT NULL);

ALTER TABLE object_access_rules DROP CONSTRAINT IF EXISTS chk_oar_everyone_needs_owner;
ALTER TABLE object_access_rules
    ADD CONSTRAINT chk_oar_everyone_needs_owner
    CHECK (grantee_everyone = FALSE OR owner_department_id IS NOT NULL OR owner_business_unit_id IS NOT NULL);

-- ---- 2. delegates ---------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_share_delegates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_kind VARCHAR(20) NOT NULL CHECK (scope_kind IN ('DEPARTMENT', 'BUSINESS_UNIT')),
    department_id UUID REFERENCES departments (id),
    business_unit_id UUID REFERENCES business_units (id),
    user_id UUID NOT NULL REFERENCES app_users (id),
    granted_by UUID REFERENCES app_users (id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ksd_scope CHECK (
        (scope_kind = 'DEPARTMENT' AND department_id IS NOT NULL AND business_unit_id IS NULL)
        OR (scope_kind = 'BUSINESS_UNIT' AND business_unit_id IS NOT NULL AND department_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ksd_department_user ON knowledge_share_delegates (department_id, user_id) WHERE department_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ksd_unit_user ON knowledge_share_delegates (business_unit_id, user_id) WHERE business_unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ksd_user ON knowledge_share_delegates (user_id);

-- ---- 3. links -------------------------------------------------------------------------------------------------------
-- Only the SHA-256 of the token is stored: the link is shown once, when it is made. owner = the Department (or the Business Unit) whose Head
-- or delegates may manage the link, like a share.
CREATE TABLE IF NOT EXISTS knowledge_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    scope_kind VARCHAR(20) NOT NULL CHECK (scope_kind IN ('BUSINESS_UNIT', 'DEPARTMENT', 'DOCUMENT_TYPE', 'DOCUMENT')),
    owner_business_unit_id UUID REFERENCES business_units (id),
    owner_department_id UUID REFERENCES departments (id),
    document_type_id UUID REFERENCES document_types (id),
    document_id UUID REFERENCES documents (id),
    label VARCHAR(300) NOT NULL,
    created_by UUID NOT NULL REFERENCES app_users (id),
    created_authority VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES app_users (id),
    CONSTRAINT chk_ksl_owner CHECK (owner_business_unit_id IS NOT NULL OR owner_department_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_ksl_owner_department ON knowledge_share_links (owner_department_id);
CREATE INDEX IF NOT EXISTS idx_ksl_owner_unit ON knowledge_share_links (owner_business_unit_id);

CREATE TABLE IF NOT EXISTS knowledge_share_link_redemptions (
    link_id UUID NOT NULL REFERENCES knowledge_share_links (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users (id),
    first_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    open_count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (link_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_kslr_user ON knowledge_share_link_redemptions (user_id);
