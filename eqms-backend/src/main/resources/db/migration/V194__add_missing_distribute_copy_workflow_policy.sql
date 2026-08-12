-- V160 seeded a workflow-action policy row for every CONTROLLED_COPY(_BATCH) action except
-- DISTRIBUTE_COPY (individual, non-batch distribution — e.g. distributing one recipient's copy
-- out of a multi-recipient batch without marking the whole batch Distributed at once). Without
-- this row, ControlledCopyAuthorizationService.evaluate() always returns WORKFLOW_POLICY_NOT_FOUND
-- for DISTRIBUTE_COPY — denied even for superadmin — so the "Distribute" action on an individual
-- copy has been permanently disabled since this feature was built.
WITH seeded_policy AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        document_type_id, required_permission_code, priority, active, is_system, description
    )
    SELECT
        gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'DISTRIBUTE_COPY', 'READY_FOR_DISTRIBUTION',
        NULL::uuid, 'documents.controlled_copy.distribute', 100, TRUE, TRUE, 'Distribute an individual controlled copy'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies p
        WHERE p.module_key = 'DOCUMENT_CONTROL'
          AND p.workflow_key = 'CONTROLLED_COPY'
          AND p.object_type = 'CONTROLLED_COPY'
          AND p.action_code = 'DISTRIBUTE_COPY'
          AND p.from_status = 'READY_FOR_DISTRIBUTION'
          AND p.document_type_id IS NULL
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code)
SELECT gen_random_uuid(), sp.id, actors.actor_type, actors.actor_code
FROM seeded_policy sp
CROSS JOIN (
    VALUES
        ('DCO', NULL::varchar),
        ('DOCUMENT_ADMIN', NULL::varchar),
        ('WORKFLOW_ROLE', 'DOCUMENT_APPROVER')
) AS actors(actor_type, actor_code);
