-- REPORT-TEMPLATE-REVISION-2026-10-14: a revision that is being written (Draft, started by Upgrade) can be discarded with a reason. It is kept, with its content,
-- as Discarded, so the record shows it existed. Forward-only, idempotent.

ALTER TABLE report_template_revisions DROP CONSTRAINT IF EXISTS report_template_revisions_status_check;
ALTER TABLE report_template_revisions
    ADD CONSTRAINT report_template_revisions_status_check CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'EFFECTIVE', 'OBSOLETE', 'DISCARDED'));
ALTER TABLE report_template_revisions ADD COLUMN IF NOT EXISTS discarded_by_user_id uuid REFERENCES app_users(id);
ALTER TABLE report_template_revisions ADD COLUMN IF NOT EXISTS discarded_at timestamptz;
ALTER TABLE report_template_revisions ADD COLUMN IF NOT EXISTS discard_reason text;
