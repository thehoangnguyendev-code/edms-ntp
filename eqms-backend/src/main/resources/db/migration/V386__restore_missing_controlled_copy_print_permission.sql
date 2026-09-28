-- documents.controlled_copy.print was seeded in V171 (id 72111111-1111-1111-1111-111111111243)
-- but was later removed from the permissions catalog by some subsequent migration without anyone
-- updating the dependent workflow policy (V342__centralize_controlled_copy_print_authorization.sql),
-- which still requires it. Since that permission can never exist for any user, PRINT_COPY has been
-- unconditionally denied for everyone (ControlledCopyAuthorizationService.hasPermission check).
--
-- Restore the permission, mirroring the metadata of its immediate sibling
-- documents.controlled_copy.download_file, and grant it everywhere that sibling is already granted
-- (print and download represent the same "get a usable copy" capability tier).

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'documents.controlled_copy.print', 'Print Controlled Copy File', 'Controlled Copy Files',
       'documents', 'controlled_copy_files', 'Print an authorized controlled copy file.', 585, false
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'documents.controlled_copy.print');

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), psi.permission_set_id, p.id
FROM permission_set_items psi
JOIN permissions download_perm ON download_perm.id = psi.permission_id AND download_perm.code = 'documents.controlled_copy.download_file'
JOIN permissions p ON p.code = 'documents.controlled_copy.print'
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items existing
    WHERE existing.permission_set_id = psi.permission_set_id AND existing.permission_id = p.id
);
