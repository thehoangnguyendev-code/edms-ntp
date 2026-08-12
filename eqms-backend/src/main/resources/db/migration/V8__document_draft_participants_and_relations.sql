CREATE TABLE IF NOT EXISTS document_workflow_participants (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    participant_type VARCHAR(20) NOT NULL,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_workflow_participant UNIQUE (document_id, participant_type, user_id)
);

CREATE INDEX IF NOT EXISTS idx_document_workflow_participants_document
    ON document_workflow_participants(document_id);

CREATE INDEX IF NOT EXISTS idx_document_workflow_participants_type
    ON document_workflow_participants(participant_type);

CREATE INDEX IF NOT EXISTS idx_document_workflow_participants_user
    ON document_workflow_participants(user_id);

CREATE TABLE IF NOT EXISTS document_relations (
    id UUID PRIMARY KEY,
    source_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    target_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    relation_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_relation UNIQUE (source_document_id, target_document_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_document_relations_source
    ON document_relations(source_document_id);

CREATE INDEX IF NOT EXISTS idx_document_relations_target
    ON document_relations(target_document_id);

CREATE INDEX IF NOT EXISTS idx_document_relations_type
    ON document_relations(relation_type);
