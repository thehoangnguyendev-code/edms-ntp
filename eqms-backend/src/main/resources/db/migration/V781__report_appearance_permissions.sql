-- REPORT-APPEARANCE-PERMISSION-2026-11-14 (owner decision): the appearance of the reports (logo, header, footer, information, approval block, stamp, watermark,
-- Word page templates) has its own screen in Report Administration and its own permissions, apart from Report Properties (numbering, limits, schedules).
-- Nobody gets them by this migration: like every security change they are ticked in a Permission Set by an administrator, with an electronic signature.
-- A person who held reports.properties.manage no longer changes the appearance until the set has reports.appearance.manage.
-- Forward-only, idempotent.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'reports.appearance.view', 'View Report Appearance', 'Reporting', 'report', 'report_configuration',
       'See the appearance every report has: logo, header, footer, information, approval block, stamp, watermark and page templates.', 187, FALSE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'reports.appearance.view');

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'reports.appearance.manage', 'Manage Report Appearance', 'Reporting', 'report', 'report_configuration',
       'Change the appearance every report has. Each change is recorded in the Audit Trail and applies to reports made after it.', 188, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'reports.appearance.manage');
