-- V816: the rest of the actions of a training activity that change it (owner directive 2026-11-18: do everything, as it is in code): hold a session, record attendance, postpone or change a session, record
-- an assessment result, designate the approvers, and set the exemptions of the content. The rows say what TrainingActivityService has always checked; nothing changes in who may do what. A conductor is a person who
-- holds the permission to conduct or to organize (a relation computed by the adapter, as the service computes it); the department of the activity limits every action, as before.

INSERT INTO authorization_relation_definitions (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version, created_at, updated_at)
SELECT gen_random_uuid(), v.code, v.display_name, v.resource_type, 'WORKFLOW_PARTICIPANT', v.config::jsonb, v.description, TRUE, 0, now(), now()
FROM (VALUES
    ('CONDUCTOR', 'May conduct the activity', 'TRAINING_ACTIVITY', '{"participantType": "CONDUCTOR"}', 'Holds the permission to conduct or to organize training activities.')
) AS v(code, display_name, resource_type, config, description)
WHERE NOT EXISTS (SELECT 1 FROM authorization_relation_definitions d WHERE d.code = v.code AND d.resource_type = v.resource_type);

WITH inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description, relation_match_rule, created_at, updated_at, version)
    SELECT gen_random_uuid(), 'TRAINING', v.workflow, v.object_type, v.action_code, v.from_status,
           v.permission, 100, TRUE, TRUE, v.description, 'ANY', now(), now(), 0
    FROM (VALUES
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'HOLD_SESSION', 'NOTIFIED', '', 'A conductor, in the department of the activity, holds a session; the first one starts the activity, with a signature.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'HOLD_SESSION', 'IN_PROGRESS', '', 'A conductor, in the department of the activity, holds a session; the first one starts the activity, with a signature.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'RECORD_ATTENDANCE', 'IN_PROGRESS', '', 'A conductor records the attendance of a person in a session that is being held.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'POSTPONE_SESSION', 'PLANNED', 'training.activity.organize', 'A person who organizes, in the department, moves a session that has not started, with a reason.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'POSTPONE_SESSION', 'NOTIFIED', 'training.activity.organize', 'A person who organizes, in the department, moves a session that has not started, with a reason.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'POSTPONE_SESSION', 'IN_PROGRESS', 'training.activity.organize', 'A person who organizes, in the department, moves a session that has not started, with a reason.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'UPDATE_SESSION', 'PLANNED', 'training.activity.organize', 'A person who organizes, in the department, changes a session that has not started, with a reason.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'UPDATE_SESSION', 'NOTIFIED', 'training.activity.organize', 'A person who organizes, in the department, changes a session that has not started, with a reason.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'SET_CONTENT_EXEMPTIONS', 'PLANNED', 'training.activity.organize', 'A person who organizes, in the department, sets the exemption of the materials or of the assessment, until the content is reviewed.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'SET_CONTENT_EXEMPTIONS', 'NOTIFIED', 'training.activity.organize', 'A person who organizes, in the department, sets the exemption of the materials or of the assessment, until the content is reviewed.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'RECORD_ASSESSMENT', 'IN_PROGRESS', 'training.assessment.record', 'A person who records assessments, in the department, writes the result of a participant while the training is in progress.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'DESIGNATE', 'ANY', 'training.activity.organize', 'A person who organizes, in the department, designates the person of an approval step of the activity.')
    ) AS v(workflow, object_type, action_code, from_status, permission, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies p
        WHERE p.module_key = 'TRAINING' AND p.workflow_key = v.workflow AND p.object_type = v.object_type
          AND p.action_code = v.action_code AND p.from_status = v.from_status AND p.document_type_id IS NULL)
    RETURNING id, required_permission_code
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), i.id, 'PERMISSION', i.required_permission_code, now() FROM inserted i WHERE i.required_permission_code <> '';

INSERT INTO workflow_action_policy_relations (id, policy_id, relation_definition_id, require_sequence, priority, active, forbidden)
SELECT gen_random_uuid(), p.id, d.id, FALSE, 100, TRUE, r.forbidden
FROM (VALUES
    ('TRAINING_ACTIVITY', 'HOLD_SESSION', 'NOTIFIED', 'CONDUCTOR', FALSE),
    ('TRAINING_ACTIVITY', 'HOLD_SESSION', 'IN_PROGRESS', 'CONDUCTOR', FALSE),
    ('TRAINING_ACTIVITY', 'RECORD_ATTENDANCE', 'IN_PROGRESS', 'CONDUCTOR', FALSE)
) AS r(object_type, action_code, from_status, relation_code, forbidden)
JOIN workflow_action_policies p ON p.module_key = 'TRAINING' AND p.object_type = r.object_type AND p.action_code = r.action_code AND p.from_status = r.from_status
JOIN authorization_relation_definitions d ON d.code = r.relation_code AND d.resource_type = r.object_type
ON CONFLICT (policy_id, relation_definition_id) DO NOTHING;
