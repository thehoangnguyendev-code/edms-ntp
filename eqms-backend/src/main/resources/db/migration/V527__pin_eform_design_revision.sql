ALTER TABLE eform_edit_sessions ADD COLUMN design_revision_id uuid
    REFERENCES document_revisions(id);

-- Do not backfill historical sessions with a guessed revision.
CREATE INDEX idx_eform_design_revision ON eform_edit_sessions(design_revision_id)
    WHERE design_revision_id IS NOT NULL;
