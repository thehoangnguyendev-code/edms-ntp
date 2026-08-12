CREATE TABLE IF NOT EXISTS revision_workspace_snapshots (
    id UUID PRIMARY KEY,
    workspace_key VARCHAR(120) NOT NULL UNIQUE,
    source_revision_id UUID NOT NULL,
    source_document_id UUID,
    workspace_mode VARCHAR(20) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    payload_json JSONB NOT NULL,
    created_by_user_id UUID,
    updated_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_revision_workspace_snapshot_source_revision
        FOREIGN KEY (source_revision_id) REFERENCES document_revisions(id) ON DELETE CASCADE,
    CONSTRAINT fk_revision_workspace_snapshot_source_document
        FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE SET NULL,
    CONSTRAINT fk_revision_workspace_snapshot_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_revision_workspace_snapshot_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_revision_workspace_snapshots_source_revision
    ON revision_workspace_snapshots(source_revision_id);
