-- Office Online file operations are enforced through the canonical revision permissions.
-- Preserve every existing grant by copying it before retiring the two obsolete catalog codes.

WITH permission_mapping AS (
    SELECT old_permission.id AS old_permission_id, replacement.id AS replacement_permission_id
    FROM permissions old_permission
    JOIN permissions replacement ON replacement.code = CASE old_permission.code
        WHEN 'documents.office_online.upload' THEN 'documents.revision.sync_office'
        WHEN 'documents.office_online.edit' THEN 'documents.revision.edit_online'
    END
    WHERE old_permission.code IN ('documents.office_online.upload', 'documents.office_online.edit')
)
INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT item.permission_set_id, mapping.replacement_permission_id
FROM permission_set_items item
JOIN permission_mapping mapping ON mapping.old_permission_id = item.permission_id
WHERE NOT EXISTS (
    SELECT 1
    FROM permission_set_items existing_item
    WHERE existing_item.permission_set_id = item.permission_set_id
      AND existing_item.permission_id = mapping.replacement_permission_id
);

WITH permission_mapping AS (
    SELECT old_permission.id AS old_permission_id, replacement.id AS replacement_permission_id
    FROM permissions old_permission
    JOIN permissions replacement ON replacement.code = CASE old_permission.code
        WHEN 'documents.office_online.upload' THEN 'documents.revision.sync_office'
        WHEN 'documents.office_online.edit' THEN 'documents.revision.edit_online'
    END
    WHERE old_permission.code IN ('documents.office_online.upload', 'documents.office_online.edit')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT item.role_id, mapping.replacement_permission_id
FROM role_permissions item
JOIN permission_mapping mapping ON mapping.old_permission_id = item.permission_id
WHERE NOT EXISTS (
    SELECT 1
    FROM role_permissions existing_item
    WHERE existing_item.role_id = item.role_id
      AND existing_item.permission_id = mapping.replacement_permission_id
);

DELETE FROM permission_set_items
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE code IN ('documents.office_online.upload', 'documents.office_online.edit')
);

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE code IN ('documents.office_online.upload', 'documents.office_online.edit')
);

DELETE FROM permissions
WHERE code IN ('documents.office_online.upload', 'documents.office_online.edit');
