CREATE TABLE IF NOT EXISTS revision_upgrade_sessions (
    id UUID PRIMARY KEY,
    session_key VARCHAR(120) NOT NULL UNIQUE,
    source_document_id UUID NOT NULL,
    source_revision_id UUID NOT NULL,
    workspace_mode VARCHAR(20) NOT NULL DEFAULT 'upgrade',
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    payload_json JSONB NOT NULL,
    created_by_user_id UUID,
    updated_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_revision_upgrade_session_source_document
        FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_revision_upgrade_session_source_revision
        FOREIGN KEY (source_revision_id) REFERENCES document_revisions(id) ON DELETE CASCADE,
    CONSTRAINT fk_revision_upgrade_session_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_revision_upgrade_session_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_revision_upgrade_sessions_source_document
    ON revision_upgrade_sessions(source_document_id);

CREATE INDEX IF NOT EXISTS idx_revision_upgrade_sessions_source_revision
    ON revision_upgrade_sessions(source_revision_id);

ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS impact_analysis_id UUID;

CREATE INDEX IF NOT EXISTS idx_document_revisions_impact_analysis_id
    ON document_revisions(impact_analysis_id);
