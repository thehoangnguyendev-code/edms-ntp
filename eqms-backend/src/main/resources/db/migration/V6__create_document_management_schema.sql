CREATE TABLE document_statuses (
    code VARCHAR(40) PRIMARY KEY,
    label VARCHAR(120) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL,
    is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE documents (
    id UUID PRIMARY KEY,
    document_number VARCHAR(80) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    title_local_language VARCHAR(255),
    version VARCHAR(40) NOT NULL,
    status_code VARCHAR(40) NOT NULL REFERENCES document_statuses(code),
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

CREATE INDEX idx_documents_status_code ON documents (status_code);
CREATE INDEX idx_documents_document_type_id ON documents (document_type_id);
CREATE INDEX idx_documents_business_unit_id ON documents (business_unit_id);
CREATE INDEX idx_documents_department_id ON documents (department_id);
CREATE INDEX idx_documents_author_user_id ON documents (author_user_id);
CREATE INDEX idx_documents_owner_user_id ON documents (owner_user_id);
CREATE INDEX idx_documents_created_at ON documents (created_at);
CREATE INDEX idx_documents_effective_date ON documents (effective_date);
CREATE INDEX idx_documents_valid_until ON documents (valid_until);

INSERT INTO document_statuses (code, label, sort_order, is_terminal, created_at, updated_at) VALUES
    ('DRAFT', 'Draft', 1, FALSE, NOW(), NOW()),
    ('ACTIVE', 'Active', 2, FALSE, NOW(), NOW()),
    ('OBSOLETED', 'Obsoleted', 3, TRUE, NOW(), NOW()),
    ('CLOSED_CANCELLED', 'Closed - Cancelled', 4, TRUE, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;
