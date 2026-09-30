-- V499: Seed Uncontrolled Copy permission codes and attach them to existing access profiles.
-- Mirrors the seeding shape of V418 (Document Administration granular split) for the codes and
-- V160/V247's attachment style for granting -- everyone who already holds the equivalent
-- Controlled Copy operational permission also receives the matching Uncontrolled Copy one, so no
-- separate access-profile UI work is needed to pilot this feature. documents.admin.document_types.manage
-- is reused as-is (no new row) to gate the allowUncontrolledCopy checkbox, per plan.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'documents.uncontrolled_copy.request', 'Request Uncontrolled Copy',
     'Document Control', 'documents', 'uncontrolled_copy',
     'Request an uncontrolled copy of an effective document revision.', 4001, TRUE),
    (gen_random_uuid(), 'documents.uncontrolled_copy.approve_request', 'Approve Uncontrolled Copy Request',
     'Document Control', 'documents', 'uncontrolled_copy',
     'Approve a pending uncontrolled copy request.', 4002, TRUE),
    (gen_random_uuid(), 'documents.uncontrolled_copy.reject_request', 'Reject Uncontrolled Copy Request',
     'Document Control', 'documents', 'uncontrolled_copy',
     'Reject a pending uncontrolled copy request.', 4003, TRUE),
    (gen_random_uuid(), 'documents.uncontrolled_copy.cancel_request', 'Cancel Uncontrolled Copy Request',
     'Document Control', 'documents', 'uncontrolled_copy',
     'Cancel an uncontrolled copy request before distribution.', 4004, TRUE),
    (gen_random_uuid(), 'documents.uncontrolled_copy.distribute', 'Distribute Uncontrolled Copy',
     'Document Control', 'documents', 'uncontrolled_copy',
     'Distribute an approved and generated uncontrolled copy.', 4005, TRUE),
    (gen_random_uuid(), 'documents.uncontrolled_copy.view', 'View Uncontrolled Copies',
     'Document Control', 'documents', 'uncontrolled_copy',
     'View uncontrolled copy records and their status.', 4006, FALSE),
    (gen_random_uuid(), 'documents.uncontrolled_copy.view_file', 'View Uncontrolled Copy File',
     'Document Control', 'documents', 'uncontrolled_copy',
     'View the generated uncontrolled copy file.', 4007, FALSE),
    (gen_random_uuid(), 'documents.uncontrolled_copy.preview_file', 'Preview Uncontrolled Copy File',
     'Document Control', 'documents', 'uncontrolled_copy',
     'Preview the generated uncontrolled copy file in-browser.', 4008, FALSE),
    (gen_random_uuid(), 'documents.uncontrolled_copy.download_file', 'Download Uncontrolled Copy File',
     'Document Control', 'documents', 'uncontrolled_copy',
     'Download the generated uncontrolled copy file.', 4009, FALSE),
    (gen_random_uuid(), 'documents.admin.uncontrolled_copies_policy.view', 'View Uncontrolled Copies Policy',
     'Document Administration', 'documents', 'document_administration',
     'View the Uncontrolled Copies Policy screen (eligibility defaults, marking, validity).', 4010, FALSE),
    (gen_random_uuid(), 'documents.admin.uncontrolled_copies_policy.manage', 'Manage Uncontrolled Copies Policy',
     'Document Administration', 'documents', 'document_administration',
     'Create and edit the Uncontrolled Copies Policy (eligibility defaults, marking, validity).', 4011, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Mirror grants: anyone holding the Controlled Copy equivalent gets the Uncontrolled Copy code too
-- (permission_set_items), same "expand, never revoke" style as V434.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), legacy.permission_set_id, target.id
FROM permission_set_items legacy
JOIN permissions old_permission ON old_permission.id = legacy.permission_id
JOIN permissions target ON target.code = REPLACE(old_permission.code, 'documents.controlled_copy.', 'documents.uncontrolled_copy.')
WHERE old_permission.code IN (
    'documents.controlled_copy.request', 'documents.controlled_copy.approve_request',
    'documents.controlled_copy.reject_request', 'documents.controlled_copy.cancel_request',
    'documents.controlled_copy.distribute', 'documents.controlled_copy.view',
    'documents.controlled_copy.view_file', 'documents.controlled_copy.preview_file',
    'documents.controlled_copy.download_file'
)
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- Uncontrolled Copies Policy admin permissions: mirror whoever holds the Controlled Copies
-- Policy equivalent (V418/V419).
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), legacy.permission_set_id, target.id
FROM permission_set_items legacy
JOIN permissions old_permission ON old_permission.id = legacy.permission_id
JOIN permissions target ON target.code = REPLACE(old_permission.code, 'documents.admin.controlled_copies_policy.', 'documents.admin.uncontrolled_copies_policy.')
WHERE old_permission.code IN ('documents.admin.controlled_copies_policy.view', 'documents.admin.controlled_copies_policy.manage')
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
