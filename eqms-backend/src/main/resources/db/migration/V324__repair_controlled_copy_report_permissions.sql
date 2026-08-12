-- Repair the controlled-copy action actors after policy bootstrap/legacy data.
-- Some installations created the policies after V323, leaving the legacy
-- documents.workspace.manage actor in place. Keep only the canonical action
-- permission so the capability endpoint and the mutation use the same rule.

DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.workflow_key = 'CONTROLLED_COPY'
  AND policy.action_code IN ('REPORT_LOST_DAMAGED', 'UPLOAD_EVIDENCE')
  AND actor.actor_type IN ('OWNER', 'PERMISSION')
  AND actor.actor_code IN ('OWNER', 'documents.workspace.manage');

INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), policy.id, 'PERMISSION',
       CASE policy.action_code
           WHEN 'REPORT_LOST_DAMAGED' THEN 'documents.controlled_copy.report_lost_damaged'
           ELSE 'documents.controlled_copy.upload_evidence'
       END,
       now()
FROM workflow_action_policies policy
WHERE policy.workflow_key = 'CONTROLLED_COPY'
  AND policy.action_code IN ('REPORT_LOST_DAMAGED', 'UPLOAD_EVIDENCE')
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
