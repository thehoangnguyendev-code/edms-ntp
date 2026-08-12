-- A structured retention duration is required for regulated report artifacts.
-- NULL means the policy retains records permanently; no duration is inferred from
-- a display name such as "7 Years + Current".
ALTER TABLE retention_policies
    ADD COLUMN IF NOT EXISTS retention_days INTEGER NULL;

ALTER TABLE retention_policies
    ADD CONSTRAINT chk_retention_policies_retention_days
    CHECK (retention_days IS NULL OR retention_days > 0);

UPDATE retention_policies
SET retention_days = CASE name
    WHEN '7 Years + Current' THEN 2922
    WHEN '3 Years' THEN 1095
    WHEN '5 Years + Current' THEN 2190
    WHEN '1 Year' THEN 365
    ELSE retention_days
END
WHERE retention_days IS NULL;

ALTER TABLE report_artifacts
    ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ NULL;

ALTER TABLE report_artifacts
    ADD COLUMN IF NOT EXISTS purge_claimed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_report_artifacts_expiry_purge
    ON report_artifacts (expires_at)
    WHERE purged_at IS NULL AND legal_hold = FALSE;

-- The Document Status pilot receives an explicit, data-managed retention policy.
UPDATE report_definitions
SET retention_policy_id = '11111111-1111-1111-1111-111111111201'
WHERE code = 'DOCUMENT_STATUS' AND retention_policy_id IS NULL;
