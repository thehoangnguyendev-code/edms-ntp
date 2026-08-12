CREATE TABLE IF NOT EXISTS document_sub_types (
    id UUID PRIMARY KEY,
    document_type_id UUID NOT NULL REFERENCES document_types(id),
    name VARCHAR(120) NOT NULL,
    description VARCHAR(512),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_document_sub_types_type_name UNIQUE (document_type_id, name)
);

CREATE INDEX IF NOT EXISTS idx_document_sub_types_document_type_id ON document_sub_types(document_type_id);
CREATE INDEX IF NOT EXISTS idx_document_sub_types_is_active ON document_sub_types(is_active);
CREATE INDEX IF NOT EXISTS idx_document_sub_types_updated_at ON document_sub_types(updated_at);

INSERT INTO document_sub_types (id, document_type_id, name, description, is_active, created_at, updated_at)
SELECT gen_random_uuid(), dt.id, 'Guideline', 'Guideline sub-type', TRUE, NOW(), NOW()
FROM document_types dt
WHERE UPPER(dt.name) IN ('POLICY', 'GUIDELINE')
ON CONFLICT (document_type_id, name) DO NOTHING;

INSERT INTO document_sub_types (id, document_type_id, name, description, is_active, created_at, updated_at)
SELECT gen_random_uuid(), dt.id, 'Manual', 'Quality manual sub-type', TRUE, NOW(), NOW()
FROM document_types dt
WHERE UPPER(dt.name) = 'QUALITY MANUAL'
ON CONFLICT (document_type_id, name) DO NOTHING;

INSERT INTO document_sub_types (id, document_type_id, name, description, is_active, created_at, updated_at)
SELECT gen_random_uuid(), dt.id, 'Procedure', 'Standard operating procedure sub-type', TRUE, NOW(), NOW()
FROM document_types dt
WHERE UPPER(dt.short_code) = 'SOP'
ON CONFLICT (document_type_id, name) DO NOTHING;

INSERT INTO document_sub_types (id, document_type_id, name, description, is_active, created_at, updated_at)
SELECT gen_random_uuid(), dt.id, 'Work Instruction', 'Work instruction sub-type', TRUE, NOW(), NOW()
FROM document_types dt
WHERE UPPER(dt.name) IN ('WORKING INSTRUCTION', 'DRAFTING INSTRUCTION', 'INSTRUCTION', 'INSTRUCTION (WORKING INSTRUCTION, DRAFTING INSTRUCTION)')
ON CONFLICT (document_type_id, name) DO NOTHING;
