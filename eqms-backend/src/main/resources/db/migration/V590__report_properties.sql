-- REPORT-PROPERTIES-2026-10-15 (owner request): the settings of the Reports module live in one place, Report Properties, as the settings of the Documents module
-- live in Document Properties. They replace the template numbering rule (V584) and three fixed values of the code. Forward-only, idempotent.
--
-- The numbering rule (prefix, digits, last serial) is moved in with its values, so no number is issued twice. The three fixed values keep their present values.

CREATE TABLE IF NOT EXISTS report_properties (
    id                       smallint PRIMARY KEY CHECK (id = 1),
    template_number_prefix   varchar(10) NOT NULL CHECK (template_number_prefix ~ '^[A-Z][A-Z0-9]{1,9}$'),
    template_number_digits   smallint    NOT NULL CHECK (template_number_digits BETWEEN 3 AND 8),
    template_number_sequence integer     NOT NULL DEFAULT 0 CHECK (template_number_sequence >= 0),
    default_name_format_id   uuid REFERENCES report_name_formats(id),
    max_rows                 integer     NOT NULL DEFAULT 10000 CHECK (max_rows BETWEEN 1000 AND 100000),
    max_schedule_recipients  integer     NOT NULL DEFAULT 200 CHECK (max_schedule_recipients BETWEEN 1 AND 500),
    schedule_retry_minutes   integer     NOT NULL DEFAULT 5 CHECK (schedule_retry_minutes BETWEEN 1 AND 60),
    version                  integer     NOT NULL DEFAULT 1,
    updated_by               uuid,
    updated_at               timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'report_template_number_rule') THEN
        INSERT INTO report_properties (id, template_number_prefix, template_number_digits, template_number_sequence, version, updated_by, updated_at)
        SELECT 1, prefix, digits, current_sequence, version, updated_by, updated_at FROM report_template_number_rule WHERE id = 1
        ON CONFLICT (id) DO NOTHING;
        DROP TABLE report_template_number_rule;
    END IF;
END $$;

INSERT INTO report_properties (id, template_number_prefix, template_number_digits)
SELECT 1, 'RPT', 4
WHERE NOT EXISTS (SELECT 1 FROM report_properties WHERE id = 1);

-- Permissions of the screen (as documents.admin.properties.view / manage). Nobody gets them by this migration: they are ticked in a Permission Set.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'reports.properties.view', 'View Report Properties', 'Reporting', 'report', 'report_configuration',
       'See the settings of the Reports module: template numbering, default name format, report size and schedule limits.', 185, FALSE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'reports.properties.view');

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'reports.properties.manage', 'Manage Report Properties', 'Reporting', 'report', 'report_configuration',
       'Change the settings of the Reports module. Each change is recorded in the Audit Trail.', 186, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'reports.properties.manage');
