-- AccessProfileService.updateProfile() allowed `type` to be changed on ANY role, including
-- system-seeded ones, without checking is_system (the isSystem() guard there only blocked
-- deactivation). This let several seeded system profiles drift to type='CUSTOM' while
-- is_system stayed true, causing the UI badge ("Custom"/"System", read from `type`) to disagree
-- with the actual edit lock (read from `is_system`) -- confirmed affecting 5 rows: ADMINISTRATOR,
-- DCO, QUALITY, SUPERVISOR, VIEWER_OPERATOR. Self-healing rather than hardcoding these IDs, in
-- case any other environment has the same drift.
UPDATE roles
SET type = 'SYSTEM', updated_at = NOW()
WHERE is_system = true AND type <> 'SYSTEM';
