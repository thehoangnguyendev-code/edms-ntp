CREATE TABLE IF NOT EXISTS revision_review_comment_attachment (
    id UUID PRIMARY KEY,
    comment_id UUID NOT NULL REFERENCES revision_review_comments(id) ON DELETE CASCADE,
    reply_id UUID REFERENCES revision_review_comment_replies(id) ON DELETE CASCADE,
    file_url VARCHAR(1000) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by_user_id UUID NOT NULL REFERENCES app_users(id),
    uploaded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rrc_attachment_comment_id ON revision_review_comment_attachment(comment_id);
CREATE INDEX IF NOT EXISTS idx_rrc_attachment_reply_id ON revision_review_comment_attachment(reply_id);
