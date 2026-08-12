-- Widens who can Request a Controlled Copy to match the SDS authorization matrix
-- (every role except Admin — Author/Co-Author/Reviewer/Approver/DCO/View-only), via
-- the new DOCUMENT_VIEWER actor type (matches anyone who can view the parent document).
-- Existing DCO/DOCUMENT_ADMIN/OWNER actor rows for REQUEST_COPY are left untouched.
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code)
SELECT gen_random_uuid(), wap.id, 'DOCUMENT_VIEWER', NULL
FROM workflow_action_policies wap
WHERE wap.workflow_key = 'CONTROLLED_COPY'
  AND wap.action_code = 'REQUEST_COPY'
AND NOT EXISTS (
    SELECT 1 FROM workflow_action_policy_actors a
    WHERE a.policy_id = wap.id AND a.actor_type = 'DOCUMENT_VIEWER'
);
