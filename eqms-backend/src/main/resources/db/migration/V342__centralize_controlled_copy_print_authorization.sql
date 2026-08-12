-- Print is a regulated controlled-copy action.  It must use the same workflow
-- policy evaluator as the capability API; a bare controller/service permission
-- check could otherwise disagree with the UI and bypass lifecycle constraints.

WITH inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        document_type_id, required_permission_code, priority, active, is_system, description
    )
    SELECT gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'PRINT_COPY',
           status_code, NULL::uuid, 'documents.controlled_copy.print', 100, TRUE, TRUE,
           'Print an authorized controlled copy'
    FROM (VALUES ('READY_FOR_DISTRIBUTION'), ('DISTRIBUTED')) AS states(status_code)
    WHERE NOT EXISTS (
        SELECT 1
        FROM workflow_action_policies existing
        WHERE existing.module_key = 'DOCUMENT_CONTROL'
          AND existing.workflow_key = 'CONTROLLED_COPY'
          AND existing.object_type = 'CONTROLLED_COPY'
          AND existing.action_code = 'PRINT_COPY'
          AND existing.from_status = states.status_code
          AND existing.document_type_id IS NULL
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type, actor_code)
SELECT id, 'PERMISSION', 'documents.controlled_copy.print'
FROM inserted;

-- Handle installations where the policy existed before this migration but was
-- missing its actor selector.  A canonical permission selector is stable even
-- when administrators rename an access profile or operational role.
INSERT INTO workflow_action_policy_actors (policy_id, actor_type, actor_code)
SELECT policy.id, 'PERMISSION', 'documents.controlled_copy.print'
FROM workflow_action_policies policy
WHERE policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'CONTROLLED_COPY'
  AND policy.object_type = 'CONTROLLED_COPY'
  AND policy.action_code = 'PRINT_COPY'
  AND policy.active = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM workflow_action_policy_actors actor
      WHERE actor.policy_id = policy.id
        AND actor.actor_type = 'PERMISSION'
        AND actor.actor_code = 'documents.controlled_copy.print'
  );
