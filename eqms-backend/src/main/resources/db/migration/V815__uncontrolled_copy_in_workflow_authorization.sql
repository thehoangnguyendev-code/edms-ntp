-- V815: the uncontrolled copy joins Workflow Authorization (owner directive 2026-11-18: do every module, as it is in code). The rows say what UncontrolledCopyService has always checked: the permission to
-- distribute (one copy; a batch asks the same of each copy) or to cancel a request, for a copy that is Ready for Distribution. Nothing changes in who may do what.

WITH inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description, relation_match_rule, created_at, updated_at, version)
    SELECT gen_random_uuid(), 'DOCUMENT_CONTROL', v.workflow, v.object_type, v.action_code, v.from_status,
           v.permission, 100, TRUE, TRUE, v.description, 'ANY', now(), now(), 0
    FROM (VALUES
        ('UNCONTROLLED_COPY', 'UNCONTROLLED_COPY', 'DISTRIBUTE', 'READY_FOR_DISTRIBUTION', 'documents.uncontrolled_copy.distribute', 'A person who may distribute uncontrolled copies distributes a copy that is ready, with a signature.'),
        ('UNCONTROLLED_COPY', 'UNCONTROLLED_COPY', 'CANCEL', 'READY_FOR_DISTRIBUTION', 'documents.uncontrolled_copy.cancel_request', 'A person who may cancel uncontrolled copy requests cancels a copy that is ready, with a reason and a signature.')
    ) AS v(workflow, object_type, action_code, from_status, permission, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies p
        WHERE p.module_key = 'DOCUMENT_CONTROL' AND p.workflow_key = v.workflow AND p.object_type = v.object_type
          AND p.action_code = v.action_code AND p.from_status = v.from_status AND p.document_type_id IS NULL)
    RETURNING id, required_permission_code
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), i.id, 'PERMISSION', i.required_permission_code, now() FROM inserted i WHERE i.required_permission_code <> '';
