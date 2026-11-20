-- V836: one module_key per menu in the permission table (owner request 2026-11-20).
-- The table spelled three menus two ways: app-settings/settings, report/reports, security-authorization/security. The names a person reads are made from the menu
-- (utils/moduleDisplay.ts) and ModuleKeys.canonical already treats each pair as one module, so no decision changes; filters by exact key now find every row.
-- Result: 12 keys for 12 menus (settings, audit-trail, backup, dashboard, documents, notifications, preferences, reports, security, self_service, system-admin, training).
UPDATE permissions SET module_key = 'settings' WHERE module_key = 'app-settings';
UPDATE permissions SET module_key = 'reports' WHERE module_key = 'report';
UPDATE permissions SET module_key = 'security' WHERE module_key = 'security-authorization';
