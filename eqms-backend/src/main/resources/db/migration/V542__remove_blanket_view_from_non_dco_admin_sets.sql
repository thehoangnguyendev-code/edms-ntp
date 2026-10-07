-- V542: Owner decision 2026-10-06 (DOC-VISIBILITY-2026-10-06): blanket visibility of Document Control records belongs to the
-- DCO and Administrator permission sets only.
--
-- V540 granted documents.document.view_all, documents.controlled_copy.view_all and documents.uncontrolled_copy.view_all to every
-- set that used to see everything implicitly through an administration permission, so no account's access changed on upgrade.
-- This removes those three grants from the sets that are neither DCO nor Administrator. The sets keep their administration
-- permissions; they simply stop implying "see every record".
--
-- Kept (DCO / Administrator): PS_DCO_TEST, PS_DOCUMENT_DCO, PS_UAT_DOCUMENT_DCO, PS_DOCUMENT_VIEW_ALL, ROLE_DCO,
-- ROLE_ADMINISTRATOR, ROLE_DOCUMENT_CONTROLLER, SYSTEM_ADMINISTRATION.
-- The removed rows were exported to backups/removed-view-all-grants-2026-10-06.csv before this ran; to undo, insert them back.
-- Idempotent and by set code, so a database without these sets is unaffected.

DELETE FROM permission_set_items item
USING permission_sets permission_set, permissions permission
WHERE item.permission_set_id = permission_set.id
  AND item.permission_id = permission.id
  AND permission_set.code IN (
      'PS_DOCUMENT_SECURITY_ADMIN',
      'PS_UAT_DOCUMENT_SECURITY_ADMIN',
      'PS_MODULE_APP_SETTINGS_MANAGER',
      'PS_MODULE_DOCUMENTS_MANAGER',
      'PS_MODULE_SECURITY_AUTHORIZATION_MANAGER',
      'PS_MODULE_SETTINGS_MANAGER',
      'PS_MODULE_SYSTEM_ADMIN_MANAGER',
      'PS_PUBLISHING_TEMPLATE_MANAGER'
  )
  AND permission.code IN (
      'documents.document.view_all',
      'documents.controlled_copy.view_all',
      'documents.uncontrolled_copy.view_all'
  );
