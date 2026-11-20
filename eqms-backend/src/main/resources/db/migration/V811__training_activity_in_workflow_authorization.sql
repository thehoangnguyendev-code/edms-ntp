-- V811: the Activity (a training session of Training Management) joins Workflow Authorization, second lifecycle of phase C after the Requirement and the Matrix (V810; owner decision
-- 2026-11-18: every row of AUTHORIZATION_ACTION_CATALOG_TRAINING_AS_IS_2026_11_18 is approved as it is in code). The rows say what TrainingActivityService has always checked for the actions on the
-- activity itself; the actions on one participant (attendance, reading, check-in) are not part of this step. Nothing changes in who may do what.
-- A policy with no permission (the trainer sends the list and finishes the training) is decided by its relation alone, as for the policy COMPLETE_TRAINING of Document Control.

INSERT INTO authorization_relation_definitions (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version, created_at, updated_at)
SELECT gen_random_uuid(), v.code, v.display_name, v.resource_type, 'WORKFLOW_PARTICIPANT', v.config::jsonb, v.description, TRUE, 0, now(), now()
FROM (VALUES
    ('SENDER', 'Trainer or conductor', 'TRAINING_ACTIVITY', '{"participantType": "SENDER"}', 'The trainer of a session of the activity, or a conductor of the department for a session without a trainer.'),
    ('CONTENT_CREATOR', 'Creator of the activity', 'TRAINING_ACTIVITY', '{"participantType": "CONTENT_CREATOR"}', 'The person who created the activity.'),
    ('CONTENT_REVIEWER', 'Reviewer of the content (done)', 'TRAINING_ACTIVITY', '{"participantType": "CONTENT_REVIEWER"}', 'The person who signed the review of the content.'),
    ('CONTENT_REVIEW_ASSIGNEE', 'Designated content reviewer', 'TRAINING_ACTIVITY', '{"participantType": "CONTENT_REVIEW_ASSIGNEE"}', 'The person designated to review the content and not yet done.'),
    ('CONTENT_APPROVE_ASSIGNEE', 'Designated content approver', 'TRAINING_ACTIVITY', '{"participantType": "CONTENT_APPROVE_ASSIGNEE"}', 'The person designated to approve the content.'),
    ('LIST_PREPARER', 'Preparer of the list', 'TRAINING_ACTIVITY', '{"participantType": "LIST_PREPARER"}', 'The person who confirmed the list of participants.')
) AS v(code, display_name, resource_type, config, description)
WHERE NOT EXISTS (SELECT 1 FROM authorization_relation_definitions d WHERE d.code = v.code AND d.resource_type = v.resource_type);

WITH inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description, relation_match_rule, created_at, updated_at, version)
    SELECT gen_random_uuid(), 'TRAINING', v.workflow, v.object_type, v.action_code, v.from_status,
           v.permission, 100, TRUE, TRUE, v.description, 'ANY', now(), now(), 0
    FROM (VALUES
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'UPDATE', 'PLANNED', 'training.activity.organize', 'An organizer, in the department of the activity, edits it (the title, due date and unit are fixed once it is notified).'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'UPDATE', 'NOTIFIED', 'training.activity.organize', 'An organizer, in the department of the activity, edits it (the title, due date and unit are fixed once it is notified).'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'UPDATE', 'IN_PROGRESS', 'training.activity.organize', 'An organizer, in the department of the activity, edits it (the title, due date and unit are fixed once it is notified).'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'UPDATE', 'PENDING_QA_CONFIRMATION', 'training.activity.organize', 'An organizer, in the department of the activity, edits it (the title, due date and unit are fixed once it is notified).'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'ADD_SESSION', 'PLANNED', 'training.activity.organize', 'An organizer adds a session before the training starts.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'ADD_SESSION', 'NOTIFIED', 'training.activity.organize', 'An organizer adds a session before the training starts.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'ADD_PARTICIPANTS', 'PLANNED', 'training.activity.organize', 'An organizer adds people to a session until the list is confirmed.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'CONFIRM_LIST', 'PLANNED', 'training.activity.organize', 'An organizer confirms the list of participants, with a signature.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'NOTIFY', 'PLANNED', 'training.activity.organize', 'An organizer notifies the participants once the list is confirmed and the content is approved.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'CANCEL', 'PLANNED', 'training.activity.organize', 'An organizer cancels the activity with a reason and a signature, unless somebody already passed.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'CANCEL', 'NOTIFIED', 'training.activity.organize', 'An organizer cancels the activity with a reason and a signature, unless somebody already passed.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'CANCEL', 'IN_PROGRESS', 'training.activity.organize', 'An organizer cancels the activity with a reason and a signature, unless somebody already passed.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'CANCEL', 'PENDING_QA_CONFIRMATION', 'training.activity.organize', 'An organizer cancels the activity with a reason and a signature, unless somebody already passed.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'REOPEN_CONTENT', 'PLANNED', 'training.activity.organize', 'An organizer reopens the reviewed and approved content, with a reason and a signature.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'REOPEN_CONTENT', 'NOTIFIED', 'training.activity.organize', 'An organizer reopens the reviewed and approved content, with a reason and a signature.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'SUPPLEMENTARY', 'IN_PROGRESS', 'training.activity.organize', 'An organizer opens a supplementary training for people who were absent or failed.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'SUPPLEMENTARY', 'PENDING_QA_CONFIRMATION', 'training.activity.organize', 'An organizer opens a supplementary training for people who were absent or failed.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'SUPPLEMENTARY', 'COMPLETED', 'training.activity.organize', 'An organizer opens a supplementary training for people who were absent or failed.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'CONTENT_REVIEW', 'PLANNED', 'training.content.review', 'The person designated to review the content, who did not create the activity, signs the review.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'CONTENT_REVIEW', 'NOTIFIED', 'training.content.review', 'The person designated to review the content, who did not create the activity, signs the review.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'CONTENT_APPROVE', 'PLANNED', 'training.content.approve', 'The person designated to approve the content, who neither created the activity nor reviewed the content, signs the approval.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'CONTENT_APPROVE', 'NOTIFIED', 'training.content.approve', 'The person designated to approve the content, who neither created the activity nor reviewed the content, signs the approval.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'SEND_ATTENDANCE_LIST', 'IN_PROGRESS', '', 'The trainer of a session (or, for a session without a trainer, a conductor of the department) sends the attendance list.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'FINISH', 'IN_PROGRESS', '', 'The trainer (or the conductor of the department) finishes the training and sends the results to QA, with a signature.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'CONFIRM_COMPLETION', 'PENDING_QA_CONFIRMATION', 'training.activity.close', 'A person who may close activities, in the department, other than the one who prepared the list, confirms the completion.'),
        ('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'RETURN_FOR_CORRECTION', 'PENDING_QA_CONFIRMATION', 'training.activity.close', 'The same person returns the results for correction, with a reason and a signature.')
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
    ('TRAINING_ACTIVITY', 'CONTENT_REVIEW', 'PLANNED', 'CONTENT_REVIEW_ASSIGNEE', FALSE),
    ('TRAINING_ACTIVITY', 'CONTENT_REVIEW', 'PLANNED', 'CONTENT_CREATOR', TRUE),
    ('TRAINING_ACTIVITY', 'CONTENT_REVIEW', 'NOTIFIED', 'CONTENT_REVIEW_ASSIGNEE', FALSE),
    ('TRAINING_ACTIVITY', 'CONTENT_REVIEW', 'NOTIFIED', 'CONTENT_CREATOR', TRUE),
    ('TRAINING_ACTIVITY', 'CONTENT_APPROVE', 'PLANNED', 'CONTENT_APPROVE_ASSIGNEE', FALSE),
    ('TRAINING_ACTIVITY', 'CONTENT_APPROVE', 'PLANNED', 'CONTENT_CREATOR', TRUE),
    ('TRAINING_ACTIVITY', 'CONTENT_APPROVE', 'PLANNED', 'CONTENT_REVIEWER', TRUE),
    ('TRAINING_ACTIVITY', 'CONTENT_APPROVE', 'NOTIFIED', 'CONTENT_APPROVE_ASSIGNEE', FALSE),
    ('TRAINING_ACTIVITY', 'CONTENT_APPROVE', 'NOTIFIED', 'CONTENT_CREATOR', TRUE),
    ('TRAINING_ACTIVITY', 'CONTENT_APPROVE', 'NOTIFIED', 'CONTENT_REVIEWER', TRUE),
    ('TRAINING_ACTIVITY', 'SEND_ATTENDANCE_LIST', 'IN_PROGRESS', 'SENDER', FALSE),
    ('TRAINING_ACTIVITY', 'FINISH', 'IN_PROGRESS', 'SENDER', FALSE),
    ('TRAINING_ACTIVITY', 'CONFIRM_COMPLETION', 'PENDING_QA_CONFIRMATION', 'LIST_PREPARER', TRUE),
    ('TRAINING_ACTIVITY', 'RETURN_FOR_CORRECTION', 'PENDING_QA_CONFIRMATION', 'LIST_PREPARER', TRUE)
) AS r(object_type, action_code, from_status, relation_code, forbidden)
JOIN workflow_action_policies p ON p.module_key = 'TRAINING' AND p.object_type = r.object_type AND p.action_code = r.action_code AND p.from_status = r.from_status
JOIN authorization_relation_definitions d ON d.code = r.relation_code AND d.resource_type = r.object_type
ON CONFLICT (policy_id, relation_definition_id) DO NOTHING;
