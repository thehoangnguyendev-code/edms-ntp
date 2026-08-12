-- Reporting a lost or damaged controlled copy is a DCO operational action.
-- It must be governed by the immutable permission code, not ownership of the
-- particular recipient record. This keeps the capability endpoint and the
-- destroy/report endpoint consistent for all authorized DCO users.

DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'CONTROLLED_COPY'
  AND policy.action_code IN ('REPORT_LOST_DAMAGED', 'UPLOAD_EVIDENCE')
  AND actor.actor_type = 'OWNER';

DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'CONTROLLED_COPY'
  AND policy.action_code IN ('REPORT_LOST_DAMAGED', 'UPLOAD_EVIDENCE')
  AND actor.actor_type = 'PERMISSION'
  AND actor.actor_code = 'documents.workspace.manage';

INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), policy.id,
       'PERMISSION',
       CASE policy.action_code
           WHEN 'REPORT_LOST_DAMAGED' THEN 'documents.controlled_copy.report_lost_damaged'
           ELSE 'documents.controlled_copy.upload_evidence'
       END,
       now()
FROM workflow_action_policies policy
WHERE policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'CONTROLLED_COPY'
  AND policy.action_code IN ('REPORT_LOST_DAMAGED', 'UPLOAD_EVIDENCE')
  AND policy.is_system = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM workflow_action_policy_actors actor
      WHERE actor.policy_id = policy.id
        AND actor.actor_type = 'PERMISSION'
        AND actor.actor_code = CASE policy.action_code
            WHEN 'REPORT_LOST_DAMAGED' THEN 'documents.controlled_copy.report_lost_damaged'
            ELSE 'documents.controlled_copy.upload_evidence'
        END
  );
