-- V827: the system-wide Document Control "Record visibility" mode (documentVisibilityMode: PARTICIPANTS_ONLY / ALL_WITH_VIEW_PERMISSION) is removed
-- (Decision VISIBILITY-TIERS-2026-11-20). Who sees what is now chosen per Access Profile: only the records where the person is named, the
-- records of the person's department (documents.document.view_department), or all (the three view_all permissions).
--
-- The stored key is deleted so that no screen or export keeps showing a setting that does nothing. Removing it never widens access: the default
-- (PARTICIPANTS_ONLY) was already the restrictive reading. An installation that had switched the mode to ALL_WITH_VIEW_PERMISSION loses that broad
-- reading; its administrator must grant the department or view-everything level on the Access Profiles that need it (release check; DEV never set it).
UPDATE system_configurations
SET documents_config = documents_config - 'documentVisibilityMode'
WHERE documents_config ? 'documentVisibilityMode';
