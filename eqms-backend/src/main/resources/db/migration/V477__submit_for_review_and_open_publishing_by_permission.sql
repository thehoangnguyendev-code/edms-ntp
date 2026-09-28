-- V477: who may Submit for Review / Open Publishing Workspace is decided by PERMISSION, not by a fixed
-- Access Profile.
--
-- V345 narrowed both actions to the Access Profiles DCO and DOCUMENT_CONTROLLER. Business decision now:
-- the actor is whoever holds the dedicated permission, so any Access Profile (DCO today, but also an
-- Author profile, a coordinator profile, ...) can be given just these permissions without touching
-- policy data or code. This also restores the system default in WorkflowActionDefaultPolicyRegistry
-- ("Reset to System Default" produces exactly this state).
--
-- Effect to review: every profile that holds documents.revision.submit_review (resp.
-- documents.revision.open_publishing_workspace) may now perform the action; profile names no longer matter.

-- 1) relation definitions the authorization engine matches for a PERMISSION actor
INSERT INTO authorization_relation_definitions (code, display_name, resource_type, resolver_code, resolver_config, description, active)
SELECT v.code, v.display_name, 'REVISION', 'PERMISSION_RESOLVER', jsonb_build_object('permissionCode', v.permission_code),
       'Actor holds permission ' || v.permission_code || ' (any Access Profile granting it).', TRUE
FROM (VALUES
    ('PERMISSION_DOCUMENTS_REVISION_SUBMIT_REVIEW', 'Holds permission documents.revision.submit_review', 'documents.revision.submit_review'),
    ('PERMISSION_DOCUMENTS_REVISION_OPEN_PUBLISHING_WORKSPACE', 'Holds permission documents.revision.open_publishing_workspace', 'documents.revision.open_publishing_workspace')
) AS v(code, display_name, permission_code)
WHERE NOT EXISTS (
    SELECT 1 FROM authorization_relation_definitions d WHERE d.code = v.code AND d.resource_type = 'REVISION'
);

-- 2) drop the Access Profile actors/relations from the two policies
DELETE FROM workflow_action_policy_relations rel
USING workflow_action_policies policy
WHERE rel.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL' AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.action_code IN ('SUBMIT_FOR_REVIEW', 'OPEN_PUBLISHING_WORKSPACE');

DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL' AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.action_code IN ('SUBMIT_FOR_REVIEW', 'OPEN_PUBLISHING_WORKSPACE');

-- 3) actor = the policy's own required permission
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), policy.id, 'PERMISSION', policy.required_permission_code, now()
FROM workflow_action_policies policy
WHERE policy.module_key = 'DOCUMENT_CONTROL' AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.action_code IN ('SUBMIT_FOR_REVIEW', 'OPEN_PUBLISHING_WORKSPACE')
  AND policy.required_permission_code IS NOT NULL AND policy.required_permission_code <> '';

INSERT INTO workflow_action_policy_relations (policy_id, relation_definition_id, require_sequence, priority, active)
SELECT policy.id, def.id, FALSE, 100, TRUE
FROM workflow_action_policies policy
JOIN authorization_relation_definitions def
  ON def.resource_type = 'REVISION' AND def.resolver_code = 'PERMISSION_RESOLVER'
 AND def.resolver_config ->> 'permissionCode' = policy.required_permission_code
WHERE policy.module_key = 'DOCUMENT_CONTROL' AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.action_code IN ('SUBMIT_FOR_REVIEW', 'OPEN_PUBLISHING_WORKSPACE');

-- 4) profile-based relation definitions that nothing uses any more (incl. the test profile added by hand)
DELETE FROM authorization_relation_definitions def
WHERE def.resource_type = 'REVISION'
  AND def.code IN ('ACCESS_PROFILE_DCO', 'ACCESS_PROFILE_DOCUMENT_CONTROLLER', 'ACCESS_PROFILE_DCO_TEST')
  AND NOT EXISTS (SELECT 1 FROM workflow_action_policy_relations r WHERE r.relation_definition_id = def.id);
