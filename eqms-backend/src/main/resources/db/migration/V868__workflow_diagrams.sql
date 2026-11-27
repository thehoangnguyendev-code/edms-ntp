-- Workflow diagrams of Document Control and Training Management (owner decision DEC-WORKFLOW-DIAGRAM-2026-11-27): several named diagrams per module,
-- Save puts the diagram in force and needs a reason, every saved version is kept. The permissions are given by hand through Security & Authorization.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), v.code, v.name, v.category, v.module_key, 'workflow_diagram', v.description, v.display_order, TRUE
FROM (VALUES
    ('documents.workflow_diagram.view',   'View Document Control Workflows',      'Document Control',    'documents', 'See the workflow diagrams of Document Control and their earlier versions. Changes nothing.', 900),
    ('documents.workflow_diagram.manage', 'Edit Document Control Workflows',      'Document Control',    'documents', 'Create, draw, rename and delete the workflow diagrams of Document Control. A saved change is in force at once, with a reason.', 901),
    ('training.workflow_diagram.view',    'View Training Management Workflows',   'Training Management', 'training',  'See the workflow diagrams of Training Management and their earlier versions. Changes nothing.', 902),
    ('training.workflow_diagram.manage',  'Edit Training Management Workflows',   'Training Management', 'training',  'Create, draw, rename and delete the workflow diagrams of Training Management. A saved change is in force at once, with a reason.', 903)
) AS v(code, name, category, module_key, description, display_order)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

CREATE TABLE workflow_diagrams (
    id               UUID PRIMARY KEY,
    module           VARCHAR(40)  NOT NULL CHECK (module IN ('DOCUMENT_CONTROL', 'TRAINING')),
    name             VARCHAR(200) NOT NULL,
    description      VARCHAR(1000),
    diagram_xml      TEXT,
    diagram_svg      TEXT,
    version_no       INTEGER      NOT NULL DEFAULT 0,
    created_by       UUID         NOT NULL REFERENCES app_users(id),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by       UUID         NOT NULL REFERENCES app_users(id),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_by       UUID         REFERENCES app_users(id),
    deleted_at       TIMESTAMPTZ,
    delete_reason    VARCHAR(1000)
);
CREATE UNIQUE INDEX ux_workflow_diagrams_name ON workflow_diagrams (module, lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE workflow_diagram_versions (
    id          UUID PRIMARY KEY,
    diagram_id  UUID          NOT NULL REFERENCES workflow_diagrams(id),
    version_no  INTEGER       NOT NULL,
    diagram_xml TEXT          NOT NULL,
    diagram_svg TEXT          NOT NULL,
    reason      VARCHAR(1000) NOT NULL,
    saved_by    UUID          NOT NULL REFERENCES app_users(id),
    saved_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (diagram_id, version_no)
);

-- a saved version is a record: it is never changed or removed
CREATE OR REPLACE FUNCTION workflow_diagram_versions_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'workflow_diagram_versions is append-only';
END $$;
CREATE TRIGGER trg_workflow_diagram_versions_immutable BEFORE UPDATE OR DELETE ON workflow_diagram_versions
    FOR EACH ROW EXECUTE FUNCTION workflow_diagram_versions_immutable();
