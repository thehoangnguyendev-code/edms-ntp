-- V165: Periodic Access Review (RBAC master plan section 17)
-- EU-GMP Annex 11 §12.3 controlled access review; 21 CFR Part 11.10(d).

CREATE TABLE access_review_campaigns (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    review_period_start DATE,
    review_period_end   DATE,
    status              VARCHAR(20)  NOT NULL DEFAULT 'IN_PROGRESS'
        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    reviewer_id         UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    signed_at           TIMESTAMPTZ,
    signature_id        UUID,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by          UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    updated_by          UUID         REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE access_review_items (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID         NOT NULL REFERENCES access_review_campaigns(id) ON DELETE CASCADE,
    user_id             UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    -- Snapshot of the user's access state at campaign creation time
    username            VARCHAR(120) NOT NULL,
    full_name           VARCHAR(255),
    role_name           VARCHAR(40),
    user_status         VARCHAR(40),
    access_profiles     TEXT,
    permission_count    INTEGER      NOT NULL DEFAULT 0,
    is_super_admin      BOOLEAN      NOT NULL DEFAULT false,
    legacy_fallback     BOOLEAN      NOT NULL DEFAULT false,
    decision            VARCHAR(30)  NOT NULL DEFAULT 'PENDING'
        CHECK (decision IN ('PENDING', 'CONFIRMED', 'REVOKE_REQUESTED', 'MODIFY_REQUESTED')),
    decision_note       TEXT,
    decided_by          UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    decided_at          TIMESTAMPTZ
);

CREATE INDEX idx_ar_items_campaign ON access_review_items(campaign_id);
CREATE INDEX idx_ar_items_decision ON access_review_items(decision);
CREATE INDEX idx_ar_campaign_status ON access_review_campaigns(status);

-- Permissions for the Access Review module (canonical security.* family, aligned with V163)
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order)
VALUES
    (gen_random_uuid(), 'security.access_review.view', 'View Access Reviews', 'Security & Authorization', 'security-authorization', 'access_review', 'View periodic access review campaigns and their findings.', 1851),
    (gen_random_uuid(), 'security.access_review.manage', 'Manage Access Reviews', 'Security & Authorization', 'security-authorization', 'access_review', 'Create, decide, complete, and cancel access review campaigns.', 1852)
ON CONFLICT (code) DO UPDATE SET
    name        = EXCLUDED.name,
    category    = EXCLUDED.category,
    module_key  = EXCLUDED.module_key,
    group_key   = EXCLUDED.group_key,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('security.access_review.view', 'security.access_review.manage')
WHERE UPPER(COALESCE(r.code, r.name)) IN ('SYSTEM_SUPER_ADMIN', 'ADMINISTRATOR')
ON CONFLICT DO NOTHING;
