-- REPORT-TEMPLATE-REVISION-2026-10-14 (owner, 2026-10-14): what a person may do to a report template is decided by permissions that an administrator ticks in a Permission Set,
-- one permission for each action, not by a fixed role or account. Same model as the Document revision actions (documents.revision.upgrade ...). Forward-only, idempotent.
-- Nobody gets these by this migration: they are granted in Security & Authorization > Permission Sets.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'reports.definition.upgrade', 'Upgrade Report Template', 'Reporting', 'report', 'report_configuration',
       'Start the next revision of a report template from its effective revision.', 182, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'reports.definition.upgrade');

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'reports.definition.discard_revision', 'Discard Report Template Revision', 'Reporting', 'report', 'report_configuration',
       'Discard the draft revision of a report template that was started by Upgrade. The effective revision is not changed.', 183, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'reports.definition.discard_revision');

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'reports.definition.set_enabled', 'Enable or Disable Report Template', 'Reporting', 'report', 'report_configuration',
       'Disable a report template so that it can no longer be used, or enable it again. Takes effect at once and is audited.', 184, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'reports.definition.set_enabled');
