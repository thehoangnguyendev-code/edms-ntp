-- Document Components: a closed, developer-curated catalog of tokens a Document Name Format may
-- compose (Phase 1 of the Document Name Formats feature). source_table/source_field identify
-- which existing domain field a component resolves to; admins may only ever add FREE_TEXT
-- components (literal static strings) -- see DocumentComponent's class javadoc for the GMP/
-- security rationale (a name format must never be able to expose a field never meant to appear
-- in a document's public identifier).
CREATE TABLE document_components (
    id                UUID PRIMARY KEY,
    name              VARCHAR(120) NOT NULL,
    value             VARCHAR(80)  NOT NULL,
    short_description VARCHAR(512),
    source_table      VARCHAR(20)  NOT NULL,
    source_field      VARCHAR(120),
    free_text         VARCHAR(120),
    is_system_defined BOOLEAN      NOT NULL DEFAULT TRUE,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    display_order     INTEGER      NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_document_components_name UNIQUE (name),
    CONSTRAINT uq_document_components_value UNIQUE (value)
);

-- Seed the same token set already visible in the reference tool's Document Components catalog,
-- mapped onto fields that already exist in this schema today (document_types.short_code,
-- documents.document_number, document_revisions.revision_number, app_users.full_name, ...).
INSERT INTO document_components (id, name, value, short_description, source_table, source_field, is_system_defined, is_active, display_order) VALUES
    (gen_random_uuid(), 'Document Number',        'documentNumber',            'Displays the document number',                 'DOCUMENT', 'documents.document_number',        TRUE, TRUE, 10),
    (gen_random_uuid(), 'Document Name',           'documentName',              'Displays the document name',                   'DOCUMENT', 'documents.document_name',          TRUE, TRUE, 20),
    (gen_random_uuid(), 'Department Code',         'department',                'Displays the department code',                 'DOCUMENT', 'departments.code',                 TRUE, TRUE, 30),
    (gen_random_uuid(), 'Document Type',           'documentType',              'Displays the document type code',              'DOCUMENT', 'document_types.short_code',        TRUE, TRUE, 40),
    (gen_random_uuid(), 'Serial Number',           'serial_number',             'Displays the serial number',                   'DOCUMENT', 'document_types.current_sequence',  TRUE, TRUE, 50),
    (gen_random_uuid(), 'Revision Number',         'documentVersion',           'Displays the revision number',                 'REVISION', 'document_revisions.revision_number', TRUE, TRUE, 60),
    (gen_random_uuid(), 'Next Revision Number',    'nextDocumentVersion',       'Displays the next revision number',            'REVISION', 'document_revisions.revision_number', TRUE, TRUE, 70),
    (gen_random_uuid(), 'Document Owner',          'owner',                     'Displays the document owner',                  'DOCUMENT', 'documents.owner_user_id',          TRUE, TRUE, 80),
    (gen_random_uuid(), 'Document Created',        'createdAt',                 'Displays the created date of the document',    'DOCUMENT', 'documents.created_at',             TRUE, TRUE, 90),
    (gen_random_uuid(), 'Document Effective Date', 'documentEffectiveDate',     'Displays the effective date of the document',  'DOCUMENT', 'documents.effective_date',         TRUE, TRUE, 100),
    (gen_random_uuid(), 'User Name',               'user_name',                 'Displays the user name',                       'USER',     'app_users.full_name',              TRUE, TRUE, 110),
    (gen_random_uuid(), 'User Email',               'user_email',               'Displays the user email',                      'USER',     'app_users.email',                  TRUE, TRUE, 120),
    (gen_random_uuid(), 'User Main Job Title',      'user_main_job_title',      'Displays the user''s main job title',          'USER',     'app_users.position',               TRUE, TRUE, 130),
    (gen_random_uuid(), 'User Main Business Unit',  'user_main_business_unit',  'Displays the user''s main business unit',      'USER',     'app_users.business_unit',          TRUE, TRUE, 140);
