-- Records every review-snapshot PDF write so a prior review round's exact snapshot can be
-- retrieved later, even though every regeneration writes to the same MinIO object key (versioned
-- bucket + Object Lock retention already keeps the old bytes — this table just remembers which
-- version_id belongs to which round).
CREATE TABLE IF NOT EXISTS revision_snapshot_history (
    id UUID PRIMARY KEY,
    revision_id UUID NOT NULL REFERENCES document_revisions(id) ON DELETE CASCADE,
    review_round INT NOT NULL,
    object_key VARCHAR(500) NOT NULL,
    version_id VARCHAR(255),
    checksum VARCHAR(128),
    trigger_action VARCHAR(50) NOT NULL,
    generated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generated_by_user_id UUID REFERENCES app_users(id)
);

CREATE INDEX IF NOT EXISTS idx_revision_snapshot_history_revision_id
    ON revision_snapshot_history(revision_id);
