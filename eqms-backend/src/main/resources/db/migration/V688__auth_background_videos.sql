CREATE TABLE auth_background_videos (
    id UUID PRIMARY KEY,
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    content BYTEA NOT NULL,
    CHECK (octet_length(content) BETWEEN 1 AND 8388608)
);
