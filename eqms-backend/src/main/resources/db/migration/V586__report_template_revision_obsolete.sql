-- REPORT-TEMPLATE-REVISION-2026-10-14 (owner, 2026-10-14): a revision that is replaced by a newer effective one is Obsolete, as a document revision is.
-- It stays readable and comparable. Forward-only, idempotent.

ALTER TABLE report_template_revisions DROP CONSTRAINT IF EXISTS report_template_revisions_status_check;
UPDATE report_template_revisions SET status = 'OBSOLETE' WHERE status = 'SUPERSEDED';
ALTER TABLE report_template_revisions
    ADD CONSTRAINT report_template_revisions_status_check CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'EFFECTIVE', 'OBSOLETE'));
