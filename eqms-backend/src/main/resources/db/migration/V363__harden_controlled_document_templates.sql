-- Controlled-document templates use the ordinary Document/Revision lifecycle.  This migration
-- only adds explicit entitlements and immutable clone provenance; it introduces no template
-- lifecycle states or template-specific cancellation/obsoletion paths.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT v.id, v.code, v.name, v.category, v.module_key, v.group_key, v.description, v.display_order, v.requires_audit
FROM (VALUES
    ('72111111-1111-1111-1111-111111111363'::uuid, 'documents.template.use',
        'Use Controlled Document Templates', 'Document Control', 'documents', 'document_control_access',
        'Select an approved controlled-document template when creating a revision.', 783, TRUE),
    ('72111111-1111-1111-1111-111111111364'::uuid, 'documents.template.manage',
        'Manage Controlled Document Templates', 'Document Control', 'documents', 'document_control_access',
        'Create or modify a document marked as a controlled-document template.', 784, TRUE)
) AS v(id, code, name, category, module_key, group_key, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

-- Every current Author/source-uploader retains the ability to use a template.  This is an
-- entitlement grant, not a visibility rule: the API independently limits results to active,
-- effective DOCX templates matching the target document type and optional subtype.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), psi.permission_set_id, template_use.id
FROM permission_set_items psi
JOIN permissions source_upload ON source_upload.id = psi.permission_id
JOIN permissions template_use ON template_use.code = 'documents.template.use'
WHERE source_upload.code = 'documents.revision.upload_source'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- DCO entitlement is represented solely by canonical permission-set codes.  Runtime Java code
-- never checks a role/profile display name.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('documents.template.use', 'documents.template.manage')
WHERE ps.code IN ('PS_DOCUMENT_DCO', 'PS_UAT_DOCUMENT_DCO')
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

CREATE TABLE document_revision_template_lineage (
    id UUID PRIMARY KEY,
    target_revision_id UUID NOT NULL UNIQUE REFERENCES document_revisions(id) ON DELETE RESTRICT,
    source_template_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
    source_template_revision_id UUID NOT NULL REFERENCES document_revisions(id) ON DELETE RESTRICT,
    source_template_revision_number VARCHAR(80) NOT NULL,
    source_file_checksum VARCHAR(128) NOT NULL,
    source_storage_provider VARCHAR(80),
    source_storage_bucket VARCHAR(255),
    source_storage_object_key VARCHAR(1024),
    source_storage_version_id VARCHAR(512),
    target_file_checksum VARCHAR(128) NOT NULL,
    selected_by_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    selected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    placeholder_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_revision_template_lineage_source_revision
    ON document_revision_template_lineage(source_template_revision_id);
CREATE INDEX idx_document_revision_template_lineage_source_document
    ON document_revision_template_lineage(source_template_document_id);

CREATE OR REPLACE FUNCTION prevent_document_revision_template_lineage_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Document revision template lineage is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_document_revision_template_lineage_immutable
BEFORE UPDATE OR DELETE ON document_revision_template_lineage
FOR EACH ROW EXECUTE FUNCTION prevent_document_revision_template_lineage_mutation();
