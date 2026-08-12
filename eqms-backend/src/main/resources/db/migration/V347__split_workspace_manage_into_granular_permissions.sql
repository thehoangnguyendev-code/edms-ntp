-- Splits the catch-all `documents.workspace.manage` permission's role as the
-- required_permission_code gate for 4 unrelated business actions into 4 dedicated,
-- independently grantable permissions. Before this migration, any Access Profile granted
-- `documents.workspace.manage` automatically got ALL four capabilities at once (update draft
-- metadata, open publishing workspace, submit for review, update document metadata) with no
-- way to grant one without the others. This mirrors the actor-level fix in V345
-- (SUBMIT_FOR_REVIEW actor narrowed to DCO) one layer down, at the permission layer.
--
-- COMPLETE_TRAINING was originally believed to belong to this same catch-all (based on
-- WorkflowActionDefaultPolicyRegistry.java's Java snapshot), but verifying against the live
-- database showed its required_permission_code and actors had already been narrowed to
-- documents.training.{complete,manage}/training.material.manage independently, with no
-- documents.workspace.manage involved at all -- that Java snapshot was itself stale, now
-- corrected separately in WorkflowActionDefaultPolicyRegistry (same class of drift T-P1-3
-- fixed). COMPLETE_TRAINING is therefore excluded from this migration.
--
-- `documents.workspace.manage` itself is NOT removed: it remains a valid, coarser permission
-- still used as an alternate ACTOR override on several already-granular actions (CANCEL,
-- OBSOLETE, PUBLISH, UPGRADE_REVISION, REGENERATE_SNAPSHOT) — that is a deliberate, separate
-- "Document Control catch-all override" design, out of scope for this migration.
--
-- Effective-permission preservation: every permission_set that currently holds
-- `documents.workspace.manage` is granted all 4 new codes, so no user's actual capabilities
-- change on deploy. Tightening is then a manual, per-profile decision made later via the
-- Access Profiles UI — this migration only stops the involuntary bundling, it does not
-- retroactively narrow anyone's access.
--
-- Rollback (if needed):
--   UPDATE workflow_action_policies SET required_permission_code = 'documents.workspace.manage'
--   WHERE required_permission_code IN (
--     'documents.document.update_metadata', 'documents.revision.update_draft_metadata',
--     'documents.revision.open_publishing_workspace', 'documents.revision.submit_review');
--   DELETE FROM permission_set_items WHERE permission_id IN (
--     SELECT id FROM permissions WHERE code IN (
--       'documents.document.update_metadata', 'documents.revision.update_draft_metadata',
--       'documents.revision.open_publishing_workspace', 'documents.revision.submit_review'));
--   DELETE FROM permissions WHERE code IN (
--     'documents.document.update_metadata', 'documents.revision.update_draft_metadata',
--     'documents.revision.open_publishing_workspace', 'documents.revision.submit_review');

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT v.id, v.code, v.name, v.category, v.module_key, v.group_key, v.description, v.display_order, v.requires_audit
FROM (VALUES
    ('72111111-1111-1111-1111-111111111347'::uuid, 'documents.document.update_metadata',
        'Update Draft Document Metadata', 'Document Master', 'documents', 'document_master',
        'Update metadata of a Draft document master.', 651, TRUE),
    ('72111111-1111-1111-1111-111111111348'::uuid, 'documents.revision.update_draft_metadata',
        'Update Draft Revision Metadata', 'Document Control', 'documents', 'document_control_access',
        'Update metadata of a Draft document revision.', 780, TRUE),
    ('72111111-1111-1111-1111-111111111349'::uuid, 'documents.revision.open_publishing_workspace',
        'Open Publishing Workspace', 'Document Control', 'documents', 'document_control_access',
        'Open the publishing preparation workspace for a revision ready for publishing.', 781, TRUE),
    ('72111111-1111-1111-1111-111111111350'::uuid, 'documents.revision.submit_review',
        'Submit Revision for Review', 'Document Control', 'documents', 'document_control_access',
        'Submit a Draft revision for review after checking it is ready.', 782, TRUE)
) AS v(id, code, name, category, module_key, group_key, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

-- Preserve current effective permissions: grant all 4 new codes to every permission set that
-- already holds documents.workspace.manage.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), existing.permission_set_id, newp.id
FROM permission_set_items existing
JOIN permissions oldp ON oldp.id = existing.permission_id AND oldp.code = 'documents.workspace.manage'
CROSS JOIN permissions newp
WHERE newp.code IN (
    'documents.document.update_metadata', 'documents.revision.update_draft_metadata',
    'documents.revision.open_publishing_workspace', 'documents.revision.submit_review'
)
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- Re-point the required_permission_code of the 4 affected workflow_action_policies rows to
-- their dedicated permission.
UPDATE workflow_action_policies
SET required_permission_code = 'documents.document.update_metadata', updated_at = now()
WHERE module_key = 'DOCUMENT_CONTROL' AND workflow_key = 'DOCUMENT' AND object_type = 'DOCUMENT'
  AND action_code = 'UPDATE_METADATA' AND from_status = 'DRAFT'
  AND required_permission_code = 'documents.workspace.manage';

UPDATE workflow_action_policies
SET required_permission_code = 'documents.revision.update_draft_metadata', updated_at = now()
WHERE module_key = 'DOCUMENT_CONTROL' AND workflow_key = 'DOCUMENT_REVISION' AND object_type = 'REVISION'
  AND action_code = 'UPDATE_DRAFT_METADATA' AND from_status = 'DRAFT'
  AND required_permission_code = 'documents.workspace.manage';

UPDATE workflow_action_policies
SET required_permission_code = 'documents.revision.open_publishing_workspace', updated_at = now()
WHERE module_key = 'DOCUMENT_CONTROL' AND workflow_key = 'DOCUMENT_REVISION' AND object_type = 'REVISION'
  AND action_code = 'OPEN_PUBLISHING_WORKSPACE' AND from_status = 'READY_FOR_PUBLISHING'
  AND required_permission_code = 'documents.workspace.manage';

UPDATE workflow_action_policies
SET required_permission_code = 'documents.revision.submit_review', updated_at = now()
WHERE module_key = 'DOCUMENT_CONTROL' AND workflow_key = 'DOCUMENT_REVISION' AND object_type = 'REVISION'
  AND action_code = 'SUBMIT_FOR_REVIEW' AND from_status = 'DRAFT'
  AND required_permission_code = 'documents.workspace.manage';

-- SUBMIT_FOR_REVIEW and OPEN_PUBLISHING_WORKSPACE need no actor change here: V345 already
-- narrowed their actor to ACCESS_PROFILE(DCO/DOCUMENT_CONTROLLER), which does not reference a
-- permission code. The 2 policies below still carry a PERMISSION-type actor row pointing at the
-- old broad code (seeded by V291/V295) -- left untouched, that actor row would silently demand
-- BOTH the old and new permission (required_permission_code AND actor are independent gates),
-- defeating the split. Re-point those actor rows to the same new code.
UPDATE workflow_action_policy_actors actor
SET actor_code = 'documents.document.update_metadata'
FROM workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL' AND policy.workflow_key = 'DOCUMENT' AND policy.object_type = 'DOCUMENT'
  AND policy.action_code = 'UPDATE_METADATA' AND policy.from_status = 'DRAFT'
  AND actor.actor_type = 'PERMISSION' AND actor.actor_code = 'documents.workspace.manage';

UPDATE workflow_action_policy_actors actor
SET actor_code = 'documents.revision.update_draft_metadata'
FROM workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL' AND policy.workflow_key = 'DOCUMENT_REVISION' AND policy.object_type = 'REVISION'
  AND policy.action_code = 'UPDATE_DRAFT_METADATA' AND policy.from_status = 'DRAFT'
  AND actor.actor_type = 'PERMISSION' AND actor.actor_code = 'documents.workspace.manage';
