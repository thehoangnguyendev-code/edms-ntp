CREATE TABLE IF NOT EXISTS publishing_workspace_jobs (
    id UUID PRIMARY KEY,
    revision_id UUID NOT NULL REFERENCES document_revisions(id) ON DELETE CASCADE,
    requested_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL,
    message VARCHAR(500),
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_publishing_workspace_jobs_revision_created
    ON publishing_workspace_jobs(revision_id, created_at DESC);
