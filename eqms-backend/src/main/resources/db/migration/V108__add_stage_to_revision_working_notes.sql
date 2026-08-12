ALTER TABLE revision_working_notes
    ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR(20);

UPDATE revision_working_notes notes
SET workflow_stage = CASE
    WHEN revisions.status_code = 'PENDING_REVIEW' THEN 'REVIEW'
    WHEN revisions.status_code = 'PENDING_APPROVAL' THEN 'APPROVAL'
    ELSE 'LEGACY'
END
FROM document_revisions revisions
WHERE notes.revision_id = revisions.id
  AND notes.workflow_stage IS NULL;

ALTER TABLE revision_working_notes
    ALTER COLUMN workflow_stage SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_revision_working_notes_revision_stage
    ON revision_working_notes(revision_id, workflow_stage);
