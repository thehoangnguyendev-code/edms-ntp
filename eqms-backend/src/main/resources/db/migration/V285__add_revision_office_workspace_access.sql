CREATE TABLE IF NOT EXISTS revision_office_workspace_access (
    id UUID PRIMARY KEY,
    revision_id UUID NOT NULL REFERENCES document_revisions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id),
    access_role VARCHAR(30) NOT NULL,
    access_mode VARCHAR(20) NOT NULL,
    sharepoint_permission_id VARCHAR(255),
    grant_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    granted_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_revision_office_workspace_access UNIQUE (revision_id, user_id, access_role)
);

CREATE INDEX IF NOT EXISTS idx_revision_office_workspace_access_revision
    ON revision_office_workspace_access(revision_id, grant_status);
