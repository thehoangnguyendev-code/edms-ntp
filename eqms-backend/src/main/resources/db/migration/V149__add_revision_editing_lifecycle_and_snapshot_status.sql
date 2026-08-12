-- V149: Add editing lifecycle and snapshot status tracking to document_revisions.
--
-- editing_status: tracks whether Author has completed editing (IN_PROGRESS → COMPLETED)
-- source_locked:  TRUE once editing is completed; prevents further uploads / Office Online edits
-- completed_by / completed_at: who/when clicked "Complete Editing"
-- snapshot_status: tracks async review-snapshot PDF generation (GENERATING → READY / FAILED)
-- snapshot_error:  last error message when snapshot_status = FAILED

ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS editing_status   VARCHAR(30)  NOT NULL DEFAULT 'IN_PROGRESS',
    ADD COLUMN IF NOT EXISTS source_locked    BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS completed_by_user_id UUID     REFERENCES app_users(id),
    ADD COLUMN IF NOT EXISTS completed_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS snapshot_status  VARCHAR(30),
    ADD COLUMN IF NOT EXISTS snapshot_error   TEXT;

-- Backfill: revisions no longer in DRAFT are fully locked and editing is completed.
UPDATE document_revisions
SET    editing_status = 'COMPLETED',
       source_locked  = TRUE
WHERE  status_code NOT IN ('DRAFT');

-- Backfill: DRAFT revisions that already have a PREPARED electronic signature have
-- completed editing even though they haven't been submitted yet.
UPDATE document_revisions dr
SET    editing_status = 'COMPLETED',
       source_locked  = TRUE
WHERE  dr.status_code = 'DRAFT'
  AND  EXISTS (
           SELECT 1
           FROM   electronic_signatures es
           WHERE  es.revision_id = dr.id
             AND  es.meaning     = 'PREPARED'
       );
