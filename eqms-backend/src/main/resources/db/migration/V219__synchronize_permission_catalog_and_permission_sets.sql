-- Keep the persisted catalog, workflow policies, and assignable permission sets on one canonical vocabulary.

-- Previewing a controlled-copy file is intentionally governed by the file-view permission.
UPDATE workflow_action_policies
SET required_permission_code = 'documents.controlled_copy.view_file'
WHERE required_permission_code = 'documents.controlled_copy.preview_file';

-- Normalize legacy Revision capability labels to catalog codes that are actually assignable.
UPDATE workflow_action_policies
SET required_permission_code = 'documents.revision.submit_review'
WHERE required_permission_code = 'documents.revision.open_publishing_workspace';

-- Replace UAT-only document Permission Sets with stable, production-named equivalents.
CREATE TEMP TABLE permission_set_rename_map (
    legacy_code varchar(100) primary key,
    canonical_code varchar(100) not null,
    canonical_name varchar(200) not null,
    canonical_description text not null
) ON COMMIT DROP;

INSERT INTO permission_set_rename_map VALUES
    ('PS_UAT_DOCUMENT_AUTHOR', 'PS_DOCUMENT_AUTHOR', 'Document Author', 'Create document metadata and author the assigned revision source.'),
    ('PS_UAT_DOCUMENT_COAUTHOR', 'PS_DOCUMENT_COAUTHOR', 'Document Co-Author', 'Edit an assigned Draft revision online; cannot upload or complete authoring.'),
    ('PS_UAT_DOCUMENT_REVIEWER', 'PS_DOCUMENT_REVIEWER', 'Document Reviewer', 'Review or reject revisions to which the user is assigned.'),
    ('PS_UAT_DOCUMENT_APPROVER', 'PS_DOCUMENT_APPROVER', 'Document Approver', 'Approve or reject approval for revisions to which the user is assigned.'),
    ('PS_UAT_DOCUMENT_DCO', 'PS_DOCUMENT_DCO', 'Document Control Officer', 'Manage document lifecycle, training, publishing, and document metadata.'),
    ('PS_UAT_CONTROLLED_COPY_DCO', 'PS_CONTROLLED_COPY_DCO', 'Controlled Copy DCO', 'Manage controlled-copy distribution batches and lifecycle actions.'),
    ('PS_UAT_DOCUMENT_READER', 'PS_DOCUMENT_READER', 'Document Reader', 'View documents available within the user access scope.'),
    ('PS_UAT_DOCUMENT_DOWNLOADER', 'PS_DOCUMENT_DOWNLOADER', 'Document Downloader', 'Download published documents where download policy permits.'),
    ('PS_UAT_DOCUMENT_SECURITY_ADMIN', 'PS_DOCUMENT_SECURITY_ADMIN', 'Document Security Administrator', 'Manage document security configuration, policies, and workflow roles.');

INSERT INTO permission_sets (id, code, name, description, active, system)
SELECT gen_random_uuid(), map.canonical_code, map.canonical_name, map.canonical_description, TRUE, TRUE
FROM permission_set_rename_map map
WHERE NOT EXISTS (SELECT 1 FROM permission_sets existing WHERE existing.code = map.canonical_code);

-- Copy all exact grants and existing Access Profile links before retiring the old set.
INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT target.id, item.permission_id
FROM permission_set_rename_map map
JOIN permission_sets source ON source.code = map.legacy_code
JOIN permission_sets target ON target.code = map.canonical_code
JOIN permission_set_items item ON item.permission_set_id = source.id
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items existing
    WHERE existing.permission_set_id = target.id AND existing.permission_id = item.permission_id
);

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at, assigned_by)
SELECT link.access_profile_id, target.id, link.assigned_at, link.assigned_by
FROM permission_set_rename_map map
JOIN permission_sets source ON source.code = map.legacy_code
JOIN permission_sets target ON target.code = map.canonical_code
JOIN access_profile_permission_sets link ON link.permission_set_id = source.id
WHERE NOT EXISTS (
    SELECT 1 FROM access_profile_permission_sets existing
    WHERE existing.access_profile_id = link.access_profile_id AND existing.permission_set_id = target.id
);

UPDATE permission_sets legacy
SET active = FALSE, updated_at = now()
FROM permission_set_rename_map map
WHERE legacy.code = map.legacy_code;

-- Every module receives one discoverable manager set containing its full, currently implemented catalog.
-- These sets are intentionally not assigned automatically; administrators choose the applicable module set.
INSERT INTO permission_sets (id, code, name, description, active, system)
SELECT
    gen_random_uuid(),
    'PS_MODULE_' || upper(replace(module_key, '-', '_')) || '_MANAGER',
    initcap(replace(module_key, '-', ' ')) || ' Manager',
    'Full permissions currently cataloged for the ' || module_key || ' module.',
    TRUE,
    TRUE
FROM (SELECT DISTINCT module_key FROM permissions) modules
WHERE NOT EXISTS (
    SELECT 1 FROM permission_sets existing
    WHERE existing.code = 'PS_MODULE_' || upper(replace(modules.module_key, '-', '_')) || '_MANAGER'
);

INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT permission_set.id, permission.id
FROM permission_sets permission_set
JOIN permissions permission ON permission_set.code = 'PS_MODULE_' || upper(replace(permission.module_key, '-', '_')) || '_MANAGER'
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items existing
    WHERE existing.permission_set_id = permission_set.id AND existing.permission_id = permission.id
);
