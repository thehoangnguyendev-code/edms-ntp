-- Keep the "Upload Revision" entitlement consistent with the authoring
-- workflow.  Existing access profiles that already allow a user to complete
-- authoring or edit a source file must also allow that user to upload the
-- next revision source file for documents assigned to them as Author.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), source.permission_set_id, upload_permission.id
FROM (
    SELECT DISTINCT item.permission_set_id
    FROM permission_set_items item
    JOIN permissions permission ON permission.id = item.permission_id
    WHERE permission.code IN (
        'documents.revision.complete_authoring',
        'documents.revision.edit_online'
    )
) source
JOIN permissions upload_permission ON upload_permission.code = 'documents.revision.upload_source'
WHERE NOT EXISTS (
    SELECT 1
    FROM permission_set_items existing
    WHERE existing.permission_set_id = source.permission_set_id
      AND existing.permission_id = upload_permission.id
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT source.role_id, upload_permission.id
FROM (
    SELECT DISTINCT assignment.role_id
    FROM role_permissions assignment
    JOIN permissions permission ON permission.id = assignment.permission_id
    WHERE permission.code IN (
        'documents.revision.complete_authoring',
        'documents.revision.edit_online'
    )
) source
JOIN permissions upload_permission ON upload_permission.code = 'documents.revision.upload_source'
WHERE NOT EXISTS (
    SELECT 1
    FROM role_permissions existing
    WHERE existing.role_id = source.role_id
      AND existing.permission_id = upload_permission.id
);

-- Requesting a controlled copy is self-service for users who can view the
-- document.  Mirror the existing permission-set migration for direct role
-- assignments as well, so the capability returned by Document Detail is
-- consistent for either access-profile model.
INSERT INTO role_permissions (role_id, permission_id)
SELECT source.role_id, request_permission.id
FROM (
    SELECT DISTINCT assignment.role_id
    FROM role_permissions assignment
    JOIN permissions permission ON permission.id = assignment.permission_id
    WHERE permission.code IN ('documents.document.view', 'documents.module.view')
) source
JOIN permissions request_permission ON request_permission.code = 'documents.controlled_copy.request'
WHERE NOT EXISTS (
    SELECT 1
    FROM role_permissions existing
    WHERE existing.role_id = source.role_id
      AND existing.permission_id = request_permission.id
);
