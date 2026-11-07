-- V731: the hybrid authorization engine decides the actor of a policy by its RELATIONS (workflow_action_policy_relations), next to the
-- actors written by V730. SUBMIT_FOR_REVIEW was bound to the relation "holds documents.revision.submit_review", so every holder of
-- that permission (Document Control too) could still submit. Bind it to the revision's Author, as V730 did for the actors.
--
-- To let Document Control submit again, add the relation PERMISSION_DOCUMENTS_REVISION_SUBMIT_REVIEW back to this policy in
-- Workflow Authorization (match rule ANY): no deploy needed.
--
-- Rollback (if needed): delete the AUTHOR relation of the policy and insert PERMISSION_DOCUMENTS_REVISION_SUBMIT_REVIEW again.

DELETE FROM workflow_action_policy_relations relation
USING workflow_action_policies policy
WHERE relation.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.action_code = 'SUBMIT_FOR_REVIEW';

INSERT INTO workflow_action_policy_relations (id, policy_id, relation_definition_id, require_sequence, priority, active)
SELECT gen_random_uuid(), policy.id, definition.id, false, 100, true
FROM workflow_action_policies policy
JOIN authorization_relation_definitions definition
  ON definition.code = 'AUTHOR' AND definition.resource_type = 'REVISION'
WHERE policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.action_code = 'SUBMIT_FOR_REVIEW';

UPDATE workflow_action_policies
SET relation_match_rule = 'ANY', updated_at = now()
WHERE module_key = 'DOCUMENT_CONTROL' AND workflow_key = 'DOCUMENT_REVISION' AND object_type = 'REVISION'
  AND action_code = 'SUBMIT_FOR_REVIEW';
