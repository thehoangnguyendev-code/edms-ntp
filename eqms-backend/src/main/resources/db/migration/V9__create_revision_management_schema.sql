CREATE TABLE revision_statuses (
    code VARCHAR(40) PRIMARY KEY,
    label VARCHAR(120) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL,
    is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE document_revisions (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    parent_revision_id UUID REFERENCES document_revisions(id) ON DELETE SET NULL,
    document_number VARCHAR(80) NOT NULL,
    title VARCHAR(255) NOT NULL,
    title_local_language VARCHAR(255),
    revision_name VARCHAR(255) NOT NULL,
    version VARCHAR(40) NOT NULL,
    status_code VARCHAR(40) NOT NULL REFERENCES revision_statuses(code),
    document_type_id UUID NOT NULL REFERENCES document_types(id),
    business_unit_id UUID NOT NULL REFERENCES business_units(id),
    department_id UUID NOT NULL REFERENCES departments(id),
    author_user_id UUID NOT NULL REFERENCES app_users(id),
    owner_user_id UUID NOT NULL REFERENCES app_users(id),
    opened_by_user_id UUID REFERENCES app_users(id),
    last_modified_by_user_id UUID REFERENCES app_users(id),
    description VARCHAR(1024),
    knowledge_base VARCHAR(255),
    is_template BOOLEAN NOT NULL DEFAULT FALSE,
    has_related_documents BOOLEAN NOT NULL DEFAULT FALSE,
    has_correlated_documents BOOLEAN NOT NULL DEFAULT FALSE,
    effective_date DATE,
    valid_until DATE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_document_revisions_document_id ON document_revisions (document_id);
CREATE INDEX idx_document_revisions_status_code ON document_revisions (status_code);
CREATE INDEX idx_document_revisions_document_type_id ON document_revisions (document_type_id);
CREATE INDEX idx_document_revisions_business_unit_id ON document_revisions (business_unit_id);
CREATE INDEX idx_document_revisions_department_id ON document_revisions (department_id);
CREATE INDEX idx_document_revisions_author_user_id ON document_revisions (author_user_id);
CREATE INDEX idx_document_revisions_owner_user_id ON document_revisions (owner_user_id);
CREATE INDEX idx_document_revisions_created_at ON document_revisions (created_at);
CREATE INDEX idx_document_revisions_effective_date ON document_revisions (effective_date);
CREATE INDEX idx_document_revisions_valid_until ON document_revisions (valid_until);

CREATE TABLE revision_workflow_participants (
    id UUID PRIMARY KEY,
    revision_id UUID NOT NULL REFERENCES document_revisions(id) ON DELETE CASCADE,
    participant_type VARCHAR(20) NOT NULL,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_revision_workflow_participant UNIQUE (revision_id, participant_type, user_id)
);

CREATE INDEX idx_revision_workflow_participants_revision
    ON revision_workflow_participants(revision_id);

CREATE INDEX idx_revision_workflow_participants_type
    ON revision_workflow_participants(participant_type);

CREATE INDEX idx_revision_workflow_participants_user
    ON revision_workflow_participants(user_id);

CREATE TABLE revision_workflow_history (
    id UUID PRIMARY KEY,
    revision_id UUID NOT NULL REFERENCES document_revisions(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    from_status VARCHAR(40),
    to_status VARCHAR(40),
    comment VARCHAR(1024),
    acted_by_user_id UUID REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revision_workflow_history_revision
    ON revision_workflow_history(revision_id);

CREATE INDEX idx_revision_workflow_history_action
    ON revision_workflow_history(action_type);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(40) NOT NULL,
    entity_id UUID NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    from_status VARCHAR(40),
    to_status VARCHAR(40),
    comment VARCHAR(1024),
    acted_by_user_id UUID REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity
    ON audit_logs(entity_type, entity_id);

CREATE INDEX idx_audit_logs_action
    ON audit_logs(action_type);

INSERT INTO revision_statuses (code, label, sort_order, is_terminal, created_at, updated_at) VALUES
    ('DRAFT', 'Draft', 1, FALSE, NOW(), NOW()),
    ('PENDING_REVIEW', 'Pending Review', 2, FALSE, NOW(), NOW()),
    ('PENDING_APPROVAL', 'Pending Approval', 3, FALSE, NOW(), NOW()),
    ('PENDING_TRAINING', 'Pending Training', 4, FALSE, NOW(), NOW()),
    ('READY_FOR_PUBLISHING', 'Ready for Publishing', 5, FALSE, NOW(), NOW()),
    ('EFFECTIVE', 'Effective', 6, FALSE, NOW(), NOW()),
    ('OBSOLETED', 'Obsoleted', 7, TRUE, NOW(), NOW()),
    ('CLOSED_CANCELLED', 'Closed - Cancelled', 8, TRUE, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO document_revisions (
    id,
    document_id,
    parent_revision_id,
    document_number,
    title,
    title_local_language,
    revision_name,
    version,
    status_code,
    document_type_id,
    business_unit_id,
    department_id,
    author_user_id,
    owner_user_id,
    opened_by_user_id,
    last_modified_by_user_id,
    description,
    knowledge_base,
    is_template,
    has_related_documents,
    has_correlated_documents,
    effective_date,
    valid_until,
    created_at,
    updated_at
)
SELECT
    d.id,
    d.id,
    NULL,
    d.document_number,
    d.title,
    d.title_local_language,
    d.title,
    d.version,
    CASE d.status_code
        WHEN 'ACTIVE' THEN 'EFFECTIVE'
        WHEN 'OBSOLETED' THEN 'OBSOLETED'
        WHEN 'CLOSED_CANCELLED' THEN 'CLOSED_CANCELLED'
        ELSE 'DRAFT'
    END,
    d.document_type_id,
    d.business_unit_id,
    d.department_id,
    d.author_user_id,
    d.owner_user_id,
    d.opened_by_user_id,
    d.last_modified_by_user_id,
    d.description,
    d.knowledge_base,
    d.is_template,
    d.has_related_documents,
    d.has_correlated_documents,
    d.effective_date,
    d.valid_until,
    d.created_at,
    d.updated_at
FROM documents d
ON CONFLICT (id) DO NOTHING;

INSERT INTO revision_workflow_participants (
    id,
    revision_id,
    participant_type,
    user_id,
    sequence_order,
    created_at,
    updated_at
)
SELECT
    p.id,
    p.document_id,
    p.participant_type,
    p.user_id,
    p.sequence_order,
    p.created_at,
    p.updated_at
FROM document_workflow_participants p
ON CONFLICT (id) DO NOTHING;
