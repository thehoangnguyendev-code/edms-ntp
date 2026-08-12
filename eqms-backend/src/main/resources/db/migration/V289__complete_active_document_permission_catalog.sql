-- Keep the assignable permission catalog aligned with the runtime authorization
-- map.  These are distinct lifecycle/file operations and must be granted by an
-- immutable permission code, not inferred from an Access Profile display name.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    ('72111111-1111-1111-1111-111111111289', 'documents.revision.open_publishing_workspace',
        'Open Publishing Workspace', 'Revision Publishing', 'documents', 'revision_publish',
        'Open the publishing workspace for an authorised Ready for Publishing revision. Publishing remains a separate permission.', 789, TRUE),
    ('72111111-1111-1111-1111-111111111290', 'documents.revision.obsolete',
        'Obsolete Revision', 'Revision Lifecycle', 'documents', 'revision_workflow',
        'Obsolete an authorised Effective revision. An activity summary and electronic signature are required.', 790, TRUE),
    ('72111111-1111-1111-1111-111111111291', 'documents.controlled_copy.generate',
        'Generate Controlled Copy File', 'Controlled Copy Files', 'documents', 'controlled_copy_files',
        'Generate the controlled-copy file for an authorised distribution operation.', 791, TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    module_key = EXCLUDED.module_key,
    group_key = EXCLUDED.group_key,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    requires_audit = EXCLUDED.requires_audit;

-- Existing operational Document Control profiles receive the three missing
-- capabilities through their Permission Set. This preserves current DCO
-- behaviour while retaining administrator control over future profiles.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), workspace_set.permission_set_id, permission_to_add.id
FROM permission_set_items workspace_set
JOIN permissions workspace_permission
  ON workspace_permission.id = workspace_set.permission_id
 AND workspace_permission.code = 'documents.workspace.manage'
JOIN permissions permission_to_add
  ON permission_to_add.code IN (
      'documents.revision.open_publishing_workspace',
      'documents.revision.obsolete',
      'documents.controlled_copy.generate'
  )
WHERE NOT EXISTS (
    SELECT 1
    FROM permission_set_items existing
    WHERE existing.permission_set_id = workspace_set.permission_set_id
      AND existing.permission_id = permission_to_add.id
);
