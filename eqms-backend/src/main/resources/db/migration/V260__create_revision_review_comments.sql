ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS review_round INT NOT NULL DEFAULT 1;

-- PDF-anchored review comment "pins". Never touches the file itself — page_number/position_x/y
-- plus snapshot_version_token let the frontend detect when the underlying review snapshot has
-- changed since the pin was placed (e.g. Author re-uploaded during Draft) and avoid overlaying
-- it at a now-meaningless position. Nothing is ever hard-deleted, per GMP traceability —
-- withdrawal is a status change with a required reason.
CREATE TABLE IF NOT EXISTS revision_review_comments (
    id UUID PRIMARY KEY,
    revision_id UUID NOT NULL REFERENCES document_revisions(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    position_x DOUBLE PRECISION NOT NULL,
    position_y DOUBLE PRECISION NOT NULL,
    content TEXT NOT NULL,
    review_round INT NOT NULL,
    snapshot_version_token VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    resolution_note TEXT,
    created_by_user_id UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_by_user_id UUID NULL REFERENCES app_users(id),
    resolved_at TIMESTAMP WITHOUT TIME ZONE NULL,
    withdrawn_by_user_id UUID NULL REFERENCES app_users(id),
    withdrawn_at TIMESTAMP WITHOUT TIME ZONE NULL,
    withdrawal_reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_revision_review_comments_revision_id
    ON revision_review_comments(revision_id);
