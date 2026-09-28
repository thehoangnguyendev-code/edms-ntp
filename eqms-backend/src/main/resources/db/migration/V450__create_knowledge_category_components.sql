-- Knowledge Category Components: the catalogue an administrator picks Determinators and Levels from.
-- Each component names one document field (source_field) that the code knows how to read; the
-- administrator never types a column name.
CREATE TABLE knowledge_category_components (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(200) NOT NULL,
    source_field   VARCHAR(40)  NOT NULL,
    description    TEXT,
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    system_defined BOOLEAN      NOT NULL DEFAULT FALSE,
    lock_version   BIGINT       NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by     UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    updated_by     UUID         REFERENCES app_users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX uq_kcc_name ON knowledge_category_components (lower(name));
CREATE UNIQUE INDEX uq_kcc_source ON knowledge_category_components (source_field);

INSERT INTO knowledge_category_components (id, name, source_field, description, active, system_defined) VALUES
    ('00000000-0000-0000-0000-00000000d001', 'Business Unit', 'BUSINESS_UNIT', 'The Business Unit of the document.', TRUE, TRUE),
    ('00000000-0000-0000-0000-00000000d002', 'Department', 'DEPARTMENT', 'The Department of the document.', TRUE, TRUE),
    ('00000000-0000-0000-0000-00000000d003', 'Document Type', 'DOCUMENT_TYPE', 'The Document Type of the document.', TRUE, TRUE),
    ('00000000-0000-0000-0000-00000000d004', 'Sub-Type', 'SUB_TYPE', 'The Sub-Type of the document.', TRUE, TRUE),
    ('00000000-0000-0000-0000-00000000d005', 'Language', 'LANGUAGE', 'The language of the document.', TRUE, TRUE);
