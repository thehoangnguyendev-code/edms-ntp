-- Explicit metadata grants. No implicit grant is seeded for any role.
ALTER TABLE report_definitions ADD COLUMN source_code VARCHAR(100);
UPDATE report_definitions SET source_code='DOCUMENT_STATUS' WHERE code='DOCUMENT_STATUS';

CREATE TABLE report_template_role_scopes (
    definition_code VARCHAR(100) NOT NULL REFERENCES report_definitions(code) ON DELETE RESTRICT,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    scope_code VARCHAR(30) NOT NULL CHECK (scope_code IN ('PERSONAL','DEPARTMENT','BUSINESS_UNIT','SYSTEM')),
    PRIMARY KEY (definition_code, role_id)
);
CREATE INDEX idx_report_template_scope_role ON report_template_role_scopes(role_id, definition_code);

