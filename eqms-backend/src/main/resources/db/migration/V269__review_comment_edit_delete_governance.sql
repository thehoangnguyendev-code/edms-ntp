-- Review comments are soft-deleted for auditability. The legacy WITHDRAWN state is no longer
-- part of the active workflow; historical withdrawn records remain preserved in the database.
ALTER TABLE revision_review_comments
    ADD COLUMN IF NOT EXISTS updated_by_user_id UUID NULL REFERENCES app_users(id),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE NULL,
    ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID NULL REFERENCES app_users(id),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT NULL;

ALTER TABLE revision_review_comment_replies
    ADD COLUMN IF NOT EXISTS updated_by_user_id UUID NULL REFERENCES app_users(id),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE NULL,
    ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID NULL REFERENCES app_users(id),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_revision_review_comments_active
    ON revision_review_comments(revision_id, deleted_at, created_at);
