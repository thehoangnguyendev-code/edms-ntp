CREATE TABLE IF NOT EXISTS revision_workspace_items (
    id UUID PRIMARY KEY,
    workspace_key VARCHAR(120) NOT NULL,
    item_order INTEGER NOT NULL DEFAULT 0,
    document_id UUID,
    source_document_id UUID,
    source_revision_id UUID,
    target_revision_id UUID,
    workspace_mode VARCHAR(20) NOT NULL,
    decision VARCHAR(20),
    item_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    revision_status VARCHAR(40),
    document_number VARCHAR(80),
    document_name VARCHAR(255),
    revision_number VARCHAR(40),
    next_revision_number VARCHAR(40),
    payload_json JSONB NOT NULL,
    file_name VARCHAR(255),
    file_path VARCHAR(1024),
    preview_file_path VARCHAR(1024),
    error_message TEXT,
    created_by_user_id UUID,
    updated_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_revision_workspace_item_document
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
    CONSTRAINT fk_revision_workspace_item_source_document
        FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE SET NULL,
    CONSTRAINT fk_revision_workspace_item_source_revision
        FOREIGN KEY (source_revision_id) REFERENCES document_revisions(id) ON DELETE SET NULL,
    CONSTRAINT fk_revision_workspace_item_target_revision
        FOREIGN KEY (target_revision_id) REFERENCES document_revisions(id) ON DELETE SET NULL,
    CONSTRAINT fk_revision_workspace_item_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_revision_workspace_item_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_revision_workspace_items_workspace_document
    ON revision_workspace_items(workspace_key, document_id);

CREATE INDEX IF NOT EXISTS idx_revision_workspace_items_workspace_key
    ON revision_workspace_items(workspace_key);
