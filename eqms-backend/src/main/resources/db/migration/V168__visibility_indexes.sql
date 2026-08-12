-- V168: Composite indexes supporting strict participant-visibility predicates.
-- Query shapes introduced by app.security.participant-visibility-strict:
--   EXISTS (SELECT 1 FROM document_revisions r WHERE r.document_id = d.id AND r.status_code IN ('EFFECTIVE','OBSOLETED'))
--   EXISTS (SELECT 1 FROM revision_workflow_participants p WHERE p.revision_id = r.id AND p.user_id = ?)
--   EXISTS (SELECT 1 FROM document_workflow_participants p WHERE p.document_id = d.id AND p.user_id = ?)

CREATE INDEX IF NOT EXISTS idx_document_revisions_document_status
    ON document_revisions (document_id, status_code);

CREATE INDEX IF NOT EXISTS idx_revision_workflow_participants_revision_user
    ON revision_workflow_participants (revision_id, user_id);

CREATE INDEX IF NOT EXISTS idx_document_workflow_participants_document_user
    ON document_workflow_participants (document_id, user_id);
