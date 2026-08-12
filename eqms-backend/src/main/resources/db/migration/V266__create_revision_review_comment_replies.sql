-- Replies form an immutable, auditable discussion thread beneath a PDF-anchored review comment.
-- They are intentionally separate from the pin so the original review finding cannot be edited.
CREATE TABLE IF NOT EXISTS revision_review_comment_replies (
    id UUID PRIMARY KEY,
    comment_id UUID NOT NULL REFERENCES revision_review_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_revision_review_comment_replies_comment_id
    ON revision_review_comment_replies(comment_id, created_at);
