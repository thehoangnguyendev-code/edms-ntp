ALTER TABLE documents
    ADD COLUMN requires_training BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE document_revisions
    ADD COLUMN requires_training BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN training_completion_date DATE,
    ADD COLUMN published_at TIMESTAMP,
    ADD COLUMN published_by_user_id UUID;

ALTER TABLE document_revisions
    ADD CONSTRAINT fk_document_revisions_published_by_user
        FOREIGN KEY (published_by_user_id) REFERENCES app_users(id);

ALTER TABLE revision_workflow_participants
    ADD COLUMN action_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN action_comment TEXT,
    ADD COLUMN acted_at TIMESTAMP,
    ADD COLUMN signature_session_id UUID;

CREATE INDEX idx_revision_workflow_participants_action_status
    ON revision_workflow_participants(action_status);
