-- V344 (T-P0-4 / F-17): Dictionary master data (Business Unit, Department, Position, Document
-- Type, Document Sub-Type, Storage Location, Retention Policy) previously had NO permission
-- gate at either the controller or service layer -- any authenticated user could create,
-- edit, or delete this data, which in turn drives workflow_action_policies.document_type_id
-- and ObjectAccessEvaluationService's Business Unit/Department scope matching.
--
-- settings.dictionary.view / settings.dictionary.manage already exist (seeded) and are already
-- granted to SYSTEM_SUPER_ADMIN via the SYSTEM_ADMINISTRATION permission set (see
-- V243__seed_system_super_admin_permission_set.sql) -- that grant already covers the only
-- currently-assigned admin profile, so this migration does not change runtime authorization
-- for any user today.
--
-- This migration additionally seeds the QUALITY_ADMIN permission set (created empty in
-- V150__create_permission_sets.sql, never populated or assigned to an Access Profile by any
-- later migration) so it is correctly pre-configured if/when it is assigned to a profile.
--
-- Rollback (if needed):
--   DELETE FROM permission_set_items
--   WHERE permission_set_id = (SELECT id FROM permission_sets WHERE code = 'QUALITY_ADMIN')
--     AND permission_id IN (
--       SELECT id FROM permissions WHERE code IN ('settings.dictionary.view', 'settings.dictionary.manage')
--     );

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('settings.dictionary.view', 'settings.dictionary.manage')
WHERE ps.code = 'QUALITY_ADMIN'
  AND NOT EXISTS (
      SELECT 1
      FROM permission_set_items existing
      WHERE existing.permission_set_id = ps.id
        AND existing.permission_id = p.id
  );
