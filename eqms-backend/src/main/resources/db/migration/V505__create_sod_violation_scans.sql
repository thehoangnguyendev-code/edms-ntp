-- V505: SoD Violation Review becomes its own screen (Security & Authorization > Access Review's
-- sibling), persisting each scan run instead of only ever showing the most recent result. Mirrors
-- how Veeva Vault QualityDocs' Periodic Review and this system's own existing Access Review /
-- Audit Trail Periodic Review screens each keep their own history for GxP self-inspection
-- evidence -- one domain, one review screen, one history, not a single catch-all module.

CREATE TABLE sod_violation_scans (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    scanned_by        UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    scanned_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    violation_count   INTEGER      NOT NULL DEFAULT 0,
    -- Full List<SodViolationResponse> snapshot at scan time, so a historical run can still be
    -- reviewed even if the underlying constraints/access profiles have since changed.
    results           JSONB        NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_sod_violation_scans_scanned_at ON sod_violation_scans (scanned_at DESC);
