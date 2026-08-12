-- V246: Periodic Audit Trail Review (EU-GMP Annex 11 / MHRA Data Integrity Guidance —
-- audit trail must be actively reviewed, not just retained). Modeled on the existing
-- Periodic Access Review module (V165__create_access_review.sql).

CREATE TABLE audit_trail_review_campaigns (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    review_period_start DATE         NOT NULL,
    review_period_end   DATE         NOT NULL,
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

CREATE TABLE audit_trail_review_items (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID         NOT NULL REFERENCES audit_trail_review_campaigns(id) ON DELETE CASCADE,
    audit_log_id        UUID         NOT NULL REFERENCES audit_logs(id) ON DELETE RESTRICT,
    decision            VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
        CHECK (decision IN ('PENDING', 'CONFIRMED', 'FLAGGED')),
    decision_note       TEXT,
    decided_by          UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    decided_at          TIMESTAMPTZ
);

CREATE INDEX idx_atr_items_campaign ON audit_trail_review_items(campaign_id);
CREATE INDEX idx_atr_items_decision ON audit_trail_review_items(decision);
CREATE INDEX idx_atr_items_audit_log ON audit_trail_review_items(audit_log_id);
CREATE INDEX idx_atr_campaign_status ON audit_trail_review_campaigns(status);
CREATE UNIQUE INDEX idx_atr_items_unique_per_campaign ON audit_trail_review_items(campaign_id, audit_log_id);

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order)
VALUES
    (gen_random_uuid(), 'audit.review.view', 'View Audit Trail Reviews', 'Audit Trail', 'audit-trail', 'review', 'View periodic audit trail review campaigns and their findings.', 1901),
    (gen_random_uuid(), 'audit.review.manage', 'Manage Audit Trail Reviews', 'Audit Trail', 'audit-trail', 'review', 'Create, decide, complete, and cancel audit trail review campaigns.', 1902)
ON CONFLICT (code) DO UPDATE SET
    name        = EXCLUDED.name,
    category    = EXCLUDED.category,
    module_key  = EXCLUDED.module_key,
    group_key   = EXCLUDED.group_key,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order;

-- Grant to SYSTEM_SUPER_ADMIN's system-administration permission set (V243), consistent with
-- how security.access_review.* was granted alongside it — audit trail review is QA/compliance
-- oversight, not an operational document action.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('SYSTEM_ADMINISTRATION', 'audit.review.view'),
    ('SYSTEM_ADMINISTRATION', 'audit.review.manage')
) AS v(set_code, perm_code)
JOIN permission_sets ps ON ps.code = v.set_code
JOIN permissions p ON p.code = v.perm_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items i
    WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
);
