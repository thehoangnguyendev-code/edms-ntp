-- REPORT-PLATFORM-2026-10-15 (phase 1): a Report Type is a source of report data that is written in code (one provider each). Administration can see the types and
-- enable or disable them; a disabled type cannot start a template or a run. Forward-only, idempotent.
CREATE TABLE IF NOT EXISTS report_types (
    code        VARCHAR(100) PRIMARY KEY,
    enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    version     INTEGER      NOT NULL DEFAULT 1,
    updated_by  UUID         REFERENCES app_users(id),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO report_types (code) VALUES ('DOCUMENT_STATUS') ON CONFLICT (code) DO NOTHING;

-- Who may look at the Report Types, and who may enable or disable one. Nobody gets them by this migration: they are granted in Security & Authorization >
-- Permission Sets.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'reports.types.view', 'View Report Types', 'Reporting', 'report', 'report_configuration',
       'See the sources of report data (Report Types), their columns and filters, and whether each is enabled.', 185, FALSE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'reports.types.view');

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'reports.types.manage', 'Enable or Disable Report Types', 'Reporting', 'report', 'report_configuration',
       'Enable a Report Type, or disable it so that no new template or run can use it. Takes effect at once and is audited.', 186, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'reports.types.manage');
