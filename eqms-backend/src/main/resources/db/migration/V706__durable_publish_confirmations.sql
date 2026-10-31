-- No signature JWT/password is stored. Legacy jobs without a command are not replayed.
CREATE TABLE publishing_job_commands (
    job_id UUID PRIMARY KEY REFERENCES publishing_workspace_jobs(id),
    command_type VARCHAR(16) NOT NULL CHECK (command_type IN ('PUBLISH', 'PREVIEW')),
    payload JSONB NOT NULL,
    bundle JSONB NOT NULL,
    content_binding VARCHAR(64) NOT NULL,
    confirmation_id UUID UNIQUE REFERENCES used_signature_tokens(token_id),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((command_type='PUBLISH' AND confirmation_id IS NOT NULL AND confirmed_at IS NOT NULL)
        OR (command_type='PREVIEW' AND confirmation_id IS NULL))
);
CREATE INDEX idx_publishing_workspace_jobs_pending ON publishing_workspace_jobs(created_at) WHERE status='QUEUED';
