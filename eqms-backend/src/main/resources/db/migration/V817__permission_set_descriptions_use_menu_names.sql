-- V817: the generated permission sets of a module said "...cataloged for the app-settings module" (the key of the module). A person reads the name of the menu: this rewrites those descriptions, and only the
-- ones that still have the generated words, so a description an administrator wrote is never touched. Display text only: no key, code or permission changes.

UPDATE permission_sets p
SET description = 'Full permissions currently cataloged for the ' || m.menu_name || ' module.',
    updated_at = now()
FROM (VALUES
    ('app-settings', 'Application Settings'),
    ('audit-trail', 'Audit Trail'),
    ('dashboard', 'Dashboard'),
    ('documents', 'Document Control'),
    ('help-support', 'Help & Support'),
    ('notifications', 'Notifications'),
    ('preferences', 'Preferences'),
    ('reports', 'Reports'),
    ('security-authorization', 'Security & Authorization'),
    ('settings', 'Application Settings'),
    ('system-admin', 'System Administration'),
    ('training', 'Training Management'),
    ('backup', 'Backup & Restore'),
    ('security', 'Security & Authorization')
) AS m(module_key, menu_name)
WHERE p.description = 'Full permissions currently cataloged for the ' || m.module_key || ' module.';
