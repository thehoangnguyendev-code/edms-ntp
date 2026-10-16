-- V607: Document expiry processing (owner decision DOCUMENT-EXPIRY-2026-10-16, option B).
--
-- When an Active document reaches the start of its Valid Until day, the expiry job (every 15
-- minutes) voids its electronic controlled copies, expires its uncontrolled copies, and notifies
-- all Active users (in-app and email) plus the recipients of the copies. Each document is processed
-- once; this table is the idempotency record and the audit of what the job did.
--
-- Option B: documents that were already past their Valid Until when this migration runs are NOT
-- processed automatically. They are recorded here with outcome BACKFILLED so the job skips them;
-- the DCO reviews them by hand.

CREATE TABLE IF NOT EXISTS document_expiry_processing (
    document_id                 UUID        PRIMARY KEY REFERENCES documents(id),
    outcome                     VARCHAR(30) NOT NULL,
    processed_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    notified_at                 TIMESTAMPTZ,
    electronic_copies_voided    INTEGER     NOT NULL DEFAULT 0,
    uncontrolled_copies_expired INTEGER     NOT NULL DEFAULT 0,
    CONSTRAINT chk_document_expiry_outcome CHECK (outcome IN ('PROCESSED', 'BACKFILLED'))
);

CREATE INDEX IF NOT EXISTS idx_document_expiry_pending_notify
    ON document_expiry_processing (notified_at) WHERE notified_at IS NULL;

INSERT INTO document_expiry_processing (document_id, outcome, processed_at, notified_at)
SELECT d.id, 'BACKFILLED', now(), now()
FROM documents d
WHERE d.status_code = 'ACTIVE'
  AND d.is_template = FALSE
  AND d.valid_until IS NOT NULL
  AND d.valid_until <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
ON CONFLICT (document_id) DO NOTHING;
