-- REPORT-GMP-APPROVER-2026-11-13 (owner decision, option C): a report template marked "Used For GMP Decisions" is approved or returned only by a person who holds this
-- permission; every other template by a person who holds reports.definition.approve. The permission is not granted to any set by this migration: QA is
-- given it by the administrator, with an electronic signature, like any other security change.
-- Forward-only, idempotent.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'reports.definition.approve_gmp', 'Approve Report For GMP Use', 'Reporting', 'report', 'report_configuration',
       'Approve or return a report template that is marked for GMP decisions, or whose new version marks it or takes it out of GMP use. The approver must not be its author or the person who submitted it.',
       182, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'reports.definition.approve_gmp');
