-- V171: Consolidate 39 legacy (ALL_CAPS) permission codes into their canonical dotted
-- equivalents ("quy về 1 mối"), using the authoritative legacy->canonical fan-out already
-- defined in PermissionEvaluationService.PERMISSION_ALIASES as the source of truth — NOT a
-- naive 1:1 rename. Several legacy codes are coarse and alias to MANY canonical codes at
-- once (e.g. AUTHORIZE_CONTROLLED_COPY covers 11 distinct controlled-copy lifecycle actions;
-- MANAGE_ROLES covers 14 distinct security.* actions) — anyone currently holding the coarse
-- legacy code is granted the FULL set of canonical equivalents before the legacy code is
-- removed, so no one silently loses capability.
--
-- Many canonical codes referenced by PERMISSION_ALIASES were never actually seeded either
-- (forward-declared for a not-yet-finished RBAC split, e.g. the 11 granular controlled-copy
-- actions) — those are seeded here for the first time.
--
-- Safety: permissions.id is only referenced by role_permissions and permission_set_items
-- (verified — no audit/history table has a FK to permissions).

-- 1) Seed canonical permissions referenced by the alias map / application code that were
-- never in the catalog.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT id, code, name, category, module_key, group_key, description, display_order, requires_audit
FROM (VALUES
    ('72111111-1111-1111-1111-111111111230'::uuid, 'documents.document.view', 'View Document', 'Document Master', 'documents', 'document_master', 'View a document master record and its metadata.', 700, FALSE),
    ('72111111-1111-1111-1111-111111111231'::uuid, 'documents.document.create', 'Create Document Shell', 'Document Master', 'documents', 'document_master', 'Create a new document shell with metadata and workflow configuration.', 701, TRUE),
    ('72111111-1111-1111-1111-111111111232'::uuid, 'documents.document.edit_metadata', 'Edit Document Metadata', 'Document Master', 'documents', 'document_master', 'Edit document master metadata and manage the review cycle.', 702, TRUE),
    ('72111111-1111-1111-1111-111111111233'::uuid, 'documents.document.manage_relations', 'Manage Document Relationships', 'Document Master', 'documents', 'document_master', 'Manage related and correlated document links.', 703, TRUE),
    ('72111111-1111-1111-1111-111111111234'::uuid, 'documents.document.view_audit', 'View Document Audit Trail', 'Document Master', 'documents', 'document_master', 'View the audit trail of a document master record.', 704, FALSE),
    ('72111111-1111-1111-1111-111111111238'::uuid, 'documents.office_online.upload', 'Upload To Office Online', 'Revision Files', 'documents', 'revision_authoring', 'Upload a revision source file to Office Online for editing.', 705, TRUE),
    ('72111111-1111-1111-1111-111111111239'::uuid, 'documents.office_online.edit', 'Edit File Online', 'Revision Files', 'documents', 'revision_authoring', 'Edit a revision source file in Office Online.', 706, TRUE),
    ('72111111-1111-1111-1111-111111111240'::uuid, 'documents.revision.publish', 'Publish Revision', 'Revision Workflow', 'documents', 'revision_workflow', 'Publish a revision to Effective status.', 707, TRUE),
    ('72111111-1111-1111-1111-111111111241'::uuid, 'documents.controlled_copy.request', 'Request Controlled Copy', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Request issuance of a new controlled copy.', 708, TRUE),
    ('72111111-1111-1111-1111-111111111242'::uuid, 'documents.controlled_copy.view', 'View Controlled Copy Log', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'View the controlled copy distribution log.', 709, FALSE),
    ('72111111-1111-1111-1111-111111111243'::uuid, 'documents.controlled_copy.print', 'Print Controlled Copy', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Print an authorized controlled copy.', 710, TRUE),
    ('72111111-1111-1111-1111-111111111244'::uuid, 'documents.controlled_copy.approve_request', 'Approve Controlled Copy Request', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Approve a pending controlled copy request.', 711, TRUE),
    ('72111111-1111-1111-1111-111111111245'::uuid, 'documents.controlled_copy.reject_request', 'Reject Controlled Copy Request', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Reject a pending controlled copy request.', 712, TRUE),
    ('72111111-1111-1111-1111-111111111246'::uuid, 'documents.controlled_copy.prepare_distribution', 'Prepare Controlled Copy Distribution', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Prepare an approved controlled copy for distribution.', 713, TRUE),
    ('72111111-1111-1111-1111-111111111247'::uuid, 'documents.controlled_copy.distribute', 'Distribute Controlled Copy', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Mark a controlled copy as distributed to its holder.', 714, TRUE),
    ('72111111-1111-1111-1111-111111111248'::uuid, 'documents.controlled_copy.recall', 'Recall Controlled Copy', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Recall a distributed controlled copy.', 715, TRUE),
    ('72111111-1111-1111-1111-111111111249'::uuid, 'documents.controlled_copy.report_lost_damaged', 'Report Controlled Copy Lost/Damaged', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Report a controlled copy as lost or damaged.', 716, TRUE),
    ('72111111-1111-1111-1111-111111111250'::uuid, 'documents.controlled_copy.replace_lost_damaged', 'Replace Lost/Damaged Controlled Copy', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Issue a replacement for a lost or damaged controlled copy.', 717, TRUE),
    ('72111111-1111-1111-1111-111111111251'::uuid, 'documents.controlled_copy.expire', 'Expire Controlled Copy', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Expire a controlled copy at end of its validity period.', 718, TRUE),
    ('72111111-1111-1111-1111-111111111252'::uuid, 'documents.controlled_copy.destroy', 'Destroy Controlled Copy', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Record destruction of a recalled or expired controlled copy.', 719, TRUE),
    ('72111111-1111-1111-1111-111111111253'::uuid, 'documents.controlled_copy.confirm_destroy', 'Confirm Controlled Copy Destruction', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Confirm and witness controlled copy destruction.', 720, TRUE),
    ('72111111-1111-1111-1111-111111111254'::uuid, 'documents.controlled_copy.cancel_request', 'Cancel Controlled Copy Request', 'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Cancel a pending controlled copy request.', 721, TRUE),
    ('72111111-1111-1111-1111-111111111255'::uuid, 'security.users.view', 'View Users', 'System Administration', 'system-admin', 'user_management', 'View user accounts.', 722, FALSE),
    ('72111111-1111-1111-1111-111111111256'::uuid, 'security.users.create', 'Create Users', 'System Administration', 'system-admin', 'user_management', 'Create new user accounts.', 723, TRUE),
    ('72111111-1111-1111-1111-111111111257'::uuid, 'security.users.update', 'Update Users', 'System Administration', 'system-admin', 'user_management', 'Edit existing user accounts.', 724, TRUE),
    ('72111111-1111-1111-1111-111111111258'::uuid, 'security.users.delete', 'Delete Users', 'System Administration', 'system-admin', 'user_management', 'Delete user accounts.', 725, TRUE),
    ('72111111-1111-1111-1111-111111111259'::uuid, 'security.users.reset_password', 'Reset User Passwords', 'System Administration', 'system-admin', 'user_management', 'Reset another user''s password.', 726, TRUE),
    ('72111111-1111-1111-1111-111111111260'::uuid, 'settings.user.manage', 'Manage Users', 'System Administration', 'system-admin', 'user_management', 'Full user account management.', 727, TRUE),
    ('72111111-1111-1111-1111-111111111261'::uuid, 'settings.configuration.manage', 'Manage Configuration', 'System Settings', 'settings', 'system_settings', 'Manage general system configuration.', 728, TRUE),
    ('72111111-1111-1111-1111-111111111262'::uuid, 'settings.email_template.manage', 'Manage Email Templates', 'System Settings', 'settings', 'system_settings', 'Create and edit notification email templates.', 729, TRUE),
    ('72111111-1111-1111-1111-111111111263'::uuid, 'audit.view', 'View Audit Trail', 'Audit Trail', 'audit-trail', 'audit_trail', 'View the system-wide audit trail.', 730, FALSE),
    ('72111111-1111-1111-1111-111111111264'::uuid, 'audit.export', 'Export Audit Trail', 'Audit Trail', 'audit-trail', 'audit_trail', 'Export the system-wide audit trail.', 731, TRUE)
) AS v(id, code, name, category, module_key, group_key, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = v.code);

-- 2) Legacy -> canonical fan-out map (one row per legacy/canonical pair; a legacy code may
-- appear multiple times when it fans out to several canonical equivalents).
CREATE TEMP TABLE _legacy_permission_map (legacy_code varchar(80), canonical_code varchar(160)) ON COMMIT DROP;
INSERT INTO _legacy_permission_map (legacy_code, canonical_code) VALUES
    ('APPROVE_DOCUMENTS',          'documents.revision.approve'),
    ('APPROVE_REVISION',           'documents.revision.approve'),
    ('AUTHORIZE_CONTROLLED_COPY',  'documents.controlled_copy.approve_request'),
    ('AUTHORIZE_CONTROLLED_COPY',  'documents.controlled_copy.reject_request'),
    ('AUTHORIZE_CONTROLLED_COPY',  'documents.controlled_copy.prepare_distribution'),
    ('AUTHORIZE_CONTROLLED_COPY',  'documents.controlled_copy.distribute'),
    ('AUTHORIZE_CONTROLLED_COPY',  'documents.controlled_copy.recall'),
    ('AUTHORIZE_CONTROLLED_COPY',  'documents.controlled_copy.report_lost_damaged'),
    ('AUTHORIZE_CONTROLLED_COPY',  'documents.controlled_copy.replace_lost_damaged'),
    ('AUTHORIZE_CONTROLLED_COPY',  'documents.controlled_copy.expire'),
    ('AUTHORIZE_CONTROLLED_COPY',  'documents.controlled_copy.destroy'),
    ('AUTHORIZE_CONTROLLED_COPY',  'documents.controlled_copy.confirm_destroy'),
    ('AUTHORIZE_CONTROLLED_COPY',  'documents.controlled_copy.cancel_request'),
    ('CANCEL_REVISION',            'documents.revision.cancel'),
    ('COMPLETE_REVIEW',            'documents.revision.review'),
    ('COMPLETE_TRAINING',          'documents.training.complete'),
    ('CREATE_DOCUMENTS',           'documents.document.create'),
    ('CREATE_DOCUMENT_SHELL',      'documents.document.create'),
    ('EDIT_DOCUMENTS',             'documents.document.edit_metadata'),
    ('EDIT_DOCUMENT_METADATA',     'documents.document.edit_metadata'),
    ('EDIT_FILE_ONLINE',           'documents.office_online.edit'),
    ('MANAGE_DOCUMENT_RELATIONS',  'documents.document.manage_relations'),
    ('MANAGE_REVIEW_CYCLE',        'documents.document.edit_metadata'),
    ('MANAGE_TRAINING_PLAN',       'documents.training.manage'),
    ('OBSOLETE_DOCUMENT',          'documents.document.obsolete'),
    ('PRINT_CONTROLLED_COPY',      'documents.controlled_copy.print'),
    ('PUBLISH_DOCUMENTS',          'documents.revision.publish'),
    ('PUBLISH_REVISION',           'documents.revision.publish'),
    ('REJECT_REVISION',            'documents.revision.reject_review'),
    ('REQUEST_CONTROLLED_COPY',    'documents.controlled_copy.request'),
    ('REVIEW_DOCUMENTS',           'documents.revision.review'),
    ('SUBMIT_REVISION',            'documents.revision.submit_review'),
    ('UPLOAD_REVISION_FILE',       'documents.revision.upload_source'),
    ('UPLOAD_TO_OFFICE_ONLINE',    'documents.office_online.upload'),
    ('VIEW_CONTROLLED_COPY_LOG',   'documents.controlled_copy.view'),
    ('VIEW_DOCUMENTS',             'documents.module.view'),
    ('VIEW_DOCUMENT_AUDIT_TRAIL',  'documents.document.view_audit'),
    ('VIEW_FINAL_PDF_PREVIEW',     'documents.revision.publish'),
    ('EXPORT_REPORTS',             'report.module.export'),
    ('VIEW_REPORTS',               'report.module.view'),
    ('EDIT_SETTINGS',              'settings.configuration.manage'),
    ('EDIT_SETTINGS',              'settings.controlled_copy_policy.manage'),
    ('EDIT_SETTINGS',              'settings.email_template.manage'),
    ('EDIT_SETTINGS',              'settings.dictionary.manage'),
    ('MANAGE_ROLES',               'security.access_profiles.view'),
    ('MANAGE_ROLES',               'security.access_profiles.update'),
    ('MANAGE_ROLES',               'security.access_profiles.assign'),
    ('MANAGE_ROLES',               'security.permission_sets.view'),
    ('MANAGE_ROLES',               'security.permission_sets.update'),
    ('MANAGE_ROLES',               'security.workflow_authorization.view'),
    ('MANAGE_ROLES',               'security.workflow_authorization.manage'),
    ('MANAGE_ROLES',               'security.object_rules.view'),
    ('MANAGE_ROLES',               'security.object_rules.manage'),
    ('MANAGE_ROLES',               'security.sod.view'),
    ('MANAGE_ROLES',               'security.sod.manage'),
    ('MANAGE_ROLES',               'settings.role.view'),
    ('MANAGE_ROLES',               'settings.role.manage'),
    ('MANAGE_ROLES',               'settings.role.assign_permissions'),
    ('VIEW_AUDIT_TRAIL',           'documents.document.view_audit'),
    ('VIEW_AUDIT_TRAIL',           'audit.view'),
    ('VIEW_AUDIT_TRAIL',           'audit.export'),
    ('VIEW_SETTINGS',              'settings.controlled_copy_policy.view'),
    ('VIEW_SETTINGS',              'settings.dictionary.view'),
    ('CREATE_USERS',               'security.users.create'),
    ('DELETE_USERS',               'security.users.delete'),
    ('EDIT_USERS',                 'security.users.update'),
    ('EDIT_USERS',                 'settings.user.manage'),
    ('RESET_PASSWORDS',            'security.users.reset_password'),
    ('VIEW_USERS',                 'security.users.view');

-- Defensive guard: drop any mapping whose legacy source or canonical target doesn't
-- actually exist in the catalog (should never trigger after step 1, but a typo here must
-- never silently delete a legacy permission with no real replacement).
DELETE FROM _legacy_permission_map m
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = m.canonical_code)
   OR NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = m.legacy_code);

-- 3) Grant the FULL fan-out to every role currently holding a legacy code, before that
-- legacy code is removed. INSERT ... WHERE NOT EXISTS avoids duplicate (role_id, permission)
-- rows for roles that already hold the canonical permission (or multiple legacy aliases of
-- the same canonical target).
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, canon.id
FROM role_permissions rp
JOIN permissions legacy ON legacy.id = rp.permission_id
JOIN _legacy_permission_map m ON m.legacy_code = legacy.code
JOIN permissions canon ON canon.code = m.canonical_code
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp2 WHERE rp2.role_id = rp.role_id AND rp2.permission_id = canon.id
);

-- 4) Same fan-out grant for permission_set_items.
INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT DISTINCT psi.permission_set_id, canon.id
FROM permission_set_items psi
JOIN permissions legacy ON legacy.id = psi.permission_id
JOIN _legacy_permission_map m ON m.legacy_code = legacy.code
JOIN permissions canon ON canon.code = m.canonical_code
WHERE NOT EXISTS (
    SELECT 1 FROM permission_set_items psi2 WHERE psi2.permission_set_id = psi.permission_set_id AND psi2.permission_id = canon.id
);

-- 5) Every legacy-holding role/set now also holds the full canonical equivalent set —
-- safe to drop all remaining references to the 39 legacy permissions.
DELETE FROM role_permissions rp
USING permissions legacy, _legacy_permission_map m
WHERE rp.permission_id = legacy.id AND legacy.code = m.legacy_code;

DELETE FROM permission_set_items psi
USING permissions legacy, _legacy_permission_map m
WHERE psi.permission_id = legacy.id AND legacy.code = m.legacy_code;

-- 6) Free-text permission-code columns store a single code, so pick one canonical target
-- per legacy code (MIN() for determinism) — dry-run confirmed zero rows currently reference
-- any of the 39 legacy codes here, so this is a no-op safety net, not a live remap.
WITH one_target AS (
    SELECT legacy_code, MIN(canonical_code) AS canonical_code
    FROM _legacy_permission_map GROUP BY legacy_code
)
UPDATE sod_constraints c SET permission_code_a = t.canonical_code
FROM one_target t WHERE c.permission_code_a = t.legacy_code
  AND NOT EXISTS (SELECT 1 FROM sod_constraints c2 WHERE c2.id <> c.id
      AND ((c2.permission_code_a = t.canonical_code AND c2.permission_code_b = c.permission_code_b)
        OR (c2.permission_code_b = t.canonical_code AND c2.permission_code_a = c.permission_code_b)));

WITH one_target AS (
    SELECT legacy_code, MIN(canonical_code) AS canonical_code
    FROM _legacy_permission_map GROUP BY legacy_code
)
UPDATE sod_constraints c SET permission_code_b = t.canonical_code
FROM one_target t WHERE c.permission_code_b = t.legacy_code
  AND NOT EXISTS (SELECT 1 FROM sod_constraints c2 WHERE c2.id <> c.id
      AND ((c2.permission_code_a = c.permission_code_a AND c2.permission_code_b = t.canonical_code)
        OR (c2.permission_code_b = c.permission_code_a AND c2.permission_code_a = t.canonical_code)));

WITH one_target AS (
    SELECT legacy_code, MIN(canonical_code) AS canonical_code
    FROM _legacy_permission_map GROUP BY legacy_code
)
UPDATE workflow_action_policies w SET required_permission_code = t.canonical_code
FROM one_target t WHERE w.required_permission_code = t.legacy_code;

WITH one_target AS (
    SELECT legacy_code, MIN(canonical_code) AS canonical_code
    FROM _legacy_permission_map GROUP BY legacy_code
)
UPDATE lifecycle_state_policies l SET required_permission_code = t.canonical_code
FROM one_target t WHERE l.required_permission_code = t.legacy_code;

-- 7) All references repointed or fanned-out — retire the legacy catalog rows.
DELETE FROM permissions p
USING (SELECT DISTINCT legacy_code FROM _legacy_permission_map) m
WHERE p.code = m.legacy_code;
