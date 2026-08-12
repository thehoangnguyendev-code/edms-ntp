ALTER TABLE controlled_copies
    ADD COLUMN destruction_method VARCHAR(255),
    ADD COLUMN destruction_type VARCHAR(40);

CREATE TABLE controlled_copy_evidence_files (
    id UUID PRIMARY KEY,
    controlled_copy_id UUID NOT NULL REFERENCES controlled_copies(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(120),
    file_size BIGINT,
    stored_path TEXT NOT NULL,
    uploaded_by_user_id UUID REFERENCES app_users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_controlled_copy_evidence_copy_id
    ON controlled_copy_evidence_files(controlled_copy_id);
