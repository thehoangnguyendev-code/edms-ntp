ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS obsolete_reason TEXT;

CREATE TABLE IF NOT EXISTS revision_working_notes (
    id UUID PRIMARY KEY,
    revision_id UUID NOT NULL REFERENCES document_revisions(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_by_user_id UUID NULL REFERENCES app_users(id),
    deleted_at TIMESTAMP WITHOUT TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_revision_working_notes_revision_id
    ON revision_working_notes(revision_id);
