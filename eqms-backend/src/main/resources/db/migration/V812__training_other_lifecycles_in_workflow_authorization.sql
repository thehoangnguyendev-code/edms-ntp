-- V812: the other lifecycles of Training join Workflow Authorization (phase C, after the Requirement, the Matrix and the Activity of V810 and V811; owner decision 2026-11-18: every row of
-- AUTHORIZATION_ACTION_CATALOG_TRAINING_AS_IS_2026_11_18 is approved as it is in code, and the remaining lifecycles are to be done). The rows say what the services have always checked; nothing
-- changes in who may do what. A policy with no permission is decided by its relations alone. Covered here: the participant of an activity, the assessment library, the job assignment, the personnel
-- review, the export of a personal record (and of a department's batch), the trainer exception, the work suspension, the approval of an external vendor, and the voiding of a training record.

INSERT INTO authorization_relation_definitions (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version, created_at, updated_at)
SELECT gen_random_uuid(), v.code, v.display_name, v.resource_type, 'WORKFLOW_PARTICIPANT', v.config::jsonb, v.description, TRUE, 0, now(), now()
FROM (VALUES
    ('SELF', 'The participant', 'TRAINING_PARTICIPANT', '{"participantType": "SELF"}', 'The person the participant record is about.'),
    ('CONDUCTOR', 'Conductor of the activity', 'TRAINING_PARTICIPANT', '{"participantType": "CONDUCTOR"}', 'A person who holds the conduct or the organize permission.'),
    ('CREATOR', 'Creator', 'TRAINING_ASSESSMENT', '{"participantType": "CREATOR"}', 'The person who created the assessment.'),
    ('UPDATER', 'Last editor', 'TRAINING_ASSESSMENT', '{"participantType": "UPDATER"}', 'The person who edited the assessment last.'),
    ('SUBMITTER', 'Submitter', 'TRAINING_ASSESSMENT', '{"participantType": "SUBMITTER"}', 'The person who submitted the assessment for approval.'),
    ('DESIGNER_OR_APPROVER', 'Designer or approver', 'TRAINING_ASSESSMENT', '{"participantType": "DESIGNER_OR_APPROVER"}', 'A person who holds the design or the approve permission of assessments.'),
    ('RECEIVER', 'The person assigned', 'TRAINING_JOB_ASSIGNMENT', '{"participantType": "RECEIVER"}', 'The person the Work Position is assigned to.'),
    ('CREATOR', 'Creator', 'TRAINING_JOB_ASSIGNMENT', '{"participantType": "CREATOR"}', 'The person who created the assignment.'),
    ('EXCEPTION_ASSIGNEE', 'Designated approver of the exception', 'TRAINING_JOB_ASSIGNMENT', '{"participantType": "EXCEPTION_ASSIGNEE"}', 'The person designated to approve the exception.'),
    ('SUBJECT', 'The person reviewed', 'TRAINING_PERSONNEL_REVIEW', '{"participantType": "SUBJECT"}', 'The person whose training is reviewed.'),
    ('CLOSER_OK', 'May close the review', 'TRAINING_PERSONNEL_REVIEW', '{"participantType": "CLOSER_OK"}', 'No closer was chosen, or the person is the closer chosen.'),
    ('REASSIGN_RIGHT', 'May hand the closing over', 'TRAINING_PERSONNEL_REVIEW', '{"participantType": "REASSIGN_RIGHT"}', 'A person who holds the permission to reassign approval steps.'),
    ('PREPARER', 'Preparer', 'TRAINING_RECORD_EXPORT', '{"participantType": "PREPARER"}', 'The person who prepared the export.'),
    ('APPROVAL_ASSIGNEE', 'Designated approver', 'TRAINING_RECORD_EXPORT', '{"participantType": "APPROVAL_ASSIGNEE"}', 'The person designated to approve the export.'),
    ('PREPARER', 'Preparer', 'TRAINING_RECORD_EXPORT_BATCH', '{"participantType": "PREPARER"}', 'The person who prepared the batch.'),
    ('APPROVAL_ASSIGNEE', 'Designated approver', 'TRAINING_RECORD_EXPORT_BATCH', '{"participantType": "APPROVAL_ASSIGNEE"}', 'The person designated to approve the batch.'),
    ('REQUESTER', 'Requester', 'TRAINING_TRAINER_EXCEPTION', '{"participantType": "REQUESTER"}', 'The person who asked for the exception.'),
    ('TRAINER', 'The trainer', 'TRAINING_TRAINER_EXCEPTION', '{"participantType": "TRAINER"}', 'The trainer the exception is about.'),
    ('APPROVAL_ASSIGNEE', 'Designated approver', 'TRAINING_TRAINER_EXCEPTION', '{"participantType": "APPROVAL_ASSIGNEE"}', 'The person designated to decide the exception.'),
    ('SUBJECT', 'The person suspended', 'TRAINING_SUSPENSION', '{"participantType": "SUBJECT"}', 'The person whose work was suspended after a failed assessment.'),
    ('CREATOR', 'Creator', 'TRAINING_VENDOR', '{"participantType": "CREATOR"}', 'The person who created the vendor.'),
    ('CONFIRMER', 'Confirmed the completion', 'TRAINING_RECORD', '{"participantType": "CONFIRMER"}', 'The person who confirmed the completion of the activity of the record.')
) AS v(code, display_name, resource_type, config, description)
WHERE NOT EXISTS (SELECT 1 FROM authorization_relation_definitions d WHERE d.code = v.code AND d.resource_type = v.resource_type);

WITH inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description, relation_match_rule, created_at, updated_at, version)
    SELECT gen_random_uuid(), 'TRAINING', v.workflow, v.object_type, v.action_code, v.from_status,
           v.permission, 100, TRUE, TRUE, v.description, 'ANY', now(), now(), 0
    FROM (VALUES
        ('TRAINING_PARTICIPANT', 'TRAINING_PARTICIPANT', 'REMIND_TO_READ', 'NOTIFIED', '', 'A conductor, in the department of the activity, reminds an invited reader to read.'),
        ('TRAINING_PARTICIPANT', 'TRAINING_PARTICIPANT', 'REMIND_TO_READ', 'IN_PROGRESS', '', 'A conductor, in the department of the activity, reminds an invited reader to read.'),
        ('TRAINING_PARTICIPANT', 'TRAINING_PARTICIPANT', 'EXCUSE_READER', 'NOTIFIED', '', 'A conductor excuses a reader who cannot read, with a reason and a signature, but never for themselves.'),
        ('TRAINING_PARTICIPANT', 'TRAINING_PARTICIPANT', 'EXCUSE_READER', 'IN_PROGRESS', '', 'A conductor excuses a reader who cannot read, with a reason and a signature, but never for themselves.'),
        ('TRAINING_PARTICIPANT', 'TRAINING_PARTICIPANT', 'CORRECT_ATTENDANCE', 'IN_PROGRESS', '', 'A conductor corrects a recorded attendance with a reason, but never their own.'),
        ('TRAINING_PARTICIPANT', 'TRAINING_PARTICIPANT', 'SET_PARTICIPATION', 'PLANNED', '', 'A conductor sets the role of a participant, but never their own.'),
        ('TRAINING_PARTICIPANT', 'TRAINING_PARTICIPANT', 'SET_PARTICIPATION', 'NOTIFIED', '', 'A conductor sets the role of a participant, but never their own.'),
        ('TRAINING_PARTICIPANT', 'TRAINING_PARTICIPANT', 'SET_PARTICIPATION', 'IN_PROGRESS', '', 'A conductor sets the role of a participant, but never their own.'),
        ('TRAINING_PARTICIPANT', 'TRAINING_PARTICIPANT', 'REMOVE_PARTICIPANT', 'PLANNED', 'training.activity.organize', 'An organizer removes an invited person while the list is not confirmed, with a reason.'),
        ('TRAINING_PARTICIPANT', 'TRAINING_PARTICIPANT', 'SET_PLANNED_ABSENCE', 'PLANNED', 'training.activity.organize', 'An organizer records or clears a planned absence of an invited person.'),
        ('TRAINING_PARTICIPANT', 'TRAINING_PARTICIPANT', 'SET_PLANNED_ABSENCE', 'NOTIFIED', 'training.activity.organize', 'An organizer records or clears a planned absence of an invited person.'),
        ('TRAINING_PARTICIPANT', 'TRAINING_PARTICIPANT', 'CONFIRM_READ', 'NOTIFIED', 'training.self.view', 'The invited person confirms that they read the material, with a signature.'),
        ('TRAINING_PARTICIPANT', 'TRAINING_PARTICIPANT', 'CONFIRM_READ', 'IN_PROGRESS', 'training.self.view', 'The invited person confirms that they read the material, with a signature.'),
        ('TRAINING_ASSESSMENT', 'TRAINING_ASSESSMENT', 'UPDATE', 'DRAFT', 'training.assessment.design', 'A designer edits a draft assessment.'),
        ('TRAINING_ASSESSMENT', 'TRAINING_ASSESSMENT', 'DELETE', 'DRAFT', 'training.assessment.design', 'A designer deletes a draft assessment, with a reason.'),
        ('TRAINING_ASSESSMENT', 'TRAINING_ASSESSMENT', 'SUBMIT', 'DRAFT', 'training.assessment.design', 'A designer submits a draft with at least one item for approval.'),
        ('TRAINING_ASSESSMENT', 'TRAINING_ASSESSMENT', 'APPROVE', 'PENDING_APPROVAL', 'training.assessment.approve', 'An approver who did not create, edit or submit the assessment approves it, with a signature.'),
        ('TRAINING_ASSESSMENT', 'TRAINING_ASSESSMENT', 'RETURN_TO_DRAFT', 'PENDING_APPROVAL', '', 'A designer or an approver returns the assessment to Draft, with a reason.'),
        ('TRAINING_ASSESSMENT', 'TRAINING_ASSESSMENT', 'UPGRADE_REVISION', 'EFFECTIVE', 'training.assessment.design', 'A designer starts a new revision of an effective assessment.'),
        ('TRAINING_JOB_ASSIGNMENT', 'TRAINING_JOB_ASSIGNMENT', 'UPDATE', 'DRAFT', 'training.job_assignment.manage', 'A person who manages job assignments, in the department, edits a draft assignment.'),
        ('TRAINING_JOB_ASSIGNMENT', 'TRAINING_JOB_ASSIGNMENT', 'REQUEST_EXCEPTION', 'DRAFT', 'training.job_assignment.manage', 'The same person asks for an exception to the required training and chooses who approves it.'),
        ('TRAINING_JOB_ASSIGNMENT', 'TRAINING_JOB_ASSIGNMENT', 'APPROVE_EXCEPTION', 'DRAFT', 'training.job_assignment.exception.approve', 'The person designated approves the exception, unless they are the person assigned or created the assignment.'),
        ('TRAINING_JOB_ASSIGNMENT', 'TRAINING_JOB_ASSIGNMENT', 'SUBMIT', 'DRAFT', 'training.job_assignment.manage', 'The assignor signs and sends the assignment to the person, who cannot assign themselves.'),
        ('TRAINING_JOB_ASSIGNMENT', 'TRAINING_JOB_ASSIGNMENT', 'ACCEPT', 'PENDING_RECEIVER', 'training.self.view', 'The person assigned accepts, with a signature; it becomes effective.'),
        ('TRAINING_JOB_ASSIGNMENT', 'TRAINING_JOB_ASSIGNMENT', 'CANCEL', 'DRAFT', 'training.job_assignment.manage', 'A person who manages job assignments cancels the assignment, with a reason.'),
        ('TRAINING_JOB_ASSIGNMENT', 'TRAINING_JOB_ASSIGNMENT', 'CANCEL', 'PENDING_RECEIVER', 'training.job_assignment.manage', 'A person who manages job assignments cancels the assignment, with a reason.'),
        ('TRAINING_PERSONNEL_REVIEW', 'TRAINING_PERSONNEL_REVIEW', 'UPDATE_ITEM', 'OPEN', 'training.job_assignment.manage', 'A person who manages job assignments, for the department of the person reviewed, updates an item of the review.'),
        ('TRAINING_PERSONNEL_REVIEW', 'TRAINING_PERSONNEL_REVIEW', 'CREATE_ACTIVITY', 'OPEN', 'training.job_assignment.manage', 'The same person opens a training activity for an item.'),
        ('TRAINING_PERSONNEL_REVIEW', 'TRAINING_PERSONNEL_REVIEW', 'CLOSE', 'OPEN', 'training.job_assignment.manage', 'The closer chosen (or any person allowed, when none was chosen) closes the review with a signature, but not for themselves.'),
        ('TRAINING_PERSONNEL_REVIEW', 'TRAINING_PERSONNEL_REVIEW', 'CANCEL', 'OPEN', 'training.job_assignment.manage', 'A person who manages job assignments cancels the review, with a reason.'),
        ('TRAINING_PERSONNEL_REVIEW', 'TRAINING_PERSONNEL_REVIEW', 'CHANGE_CLOSER', 'OPEN', 'training.job_assignment.manage', 'A person who may reassign approval steps hands the closing over to another person, with a reason.'),
        ('TRAINING_RECORD_EXPORT', 'TRAINING_RECORD_EXPORT', 'APPROVE', 'PENDING_APPROVAL', 'training.record.export', 'The person designated, who did not prepare the export of a personal training record, approves it with a signature.'),
        ('TRAINING_RECORD_EXPORT', 'TRAINING_RECORD_EXPORT', 'REJECT', 'PENDING_APPROVAL', 'training.record.export', 'The person designated rejects the export, with a reason.'),
        ('TRAINING_RECORD_EXPORT_BATCH', 'TRAINING_RECORD_EXPORT_BATCH', 'APPROVE', 'PENDING_APPROVAL', 'training.record.export', 'The person designated, who did not prepare the yearly export of a department, approves it with a signature.'),
        ('TRAINING_RECORD_EXPORT_BATCH', 'TRAINING_RECORD_EXPORT_BATCH', 'REJECT', 'PENDING_APPROVAL', 'training.record.export', 'The person designated rejects the batch, with a reason.'),
        ('TRAINING_TRAINER_EXCEPTION', 'TRAINING_TRAINER_EXCEPTION', 'APPROVE', 'PENDING', 'training.trainer.exception.approve', 'The person designated approves a trainer who is not qualified, unless they asked for it or are the trainer.'),
        ('TRAINING_TRAINER_EXCEPTION', 'TRAINING_TRAINER_EXCEPTION', 'REJECT', 'PENDING', 'training.trainer.exception.approve', 'The person designated rejects the exception, with a reason.'),
        ('TRAINING_SUSPENSION', 'TRAINING_SUSPENSION', 'RESUME', 'OPEN', 'training.job_assignment.manage', 'A person who manages job assignments, for the department of the person, lets the work resume with a reason and a signature, but not their own.'),
        ('TRAINING_VENDOR', 'TRAINING_VENDOR', 'APPROVE', 'DRAFT', 'training.admin.manage', 'A Training administrator who did not create the external vendor approves it, with a signature.'),
        ('TRAINING_RECORD', 'TRAINING_RECORD', 'VOID', 'ACTIVE', 'training.record.void', 'A person who may void records, in the department of the activity and other than the one who confirmed its completion, voids a record with a reason and a signature.')
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
    ('TRAINING_PARTICIPANT', 'REMIND_TO_READ', 'NOTIFIED', 'CONDUCTOR', FALSE),
    ('TRAINING_PARTICIPANT', 'REMIND_TO_READ', 'IN_PROGRESS', 'CONDUCTOR', FALSE),
    ('TRAINING_PARTICIPANT', 'EXCUSE_READER', 'NOTIFIED', 'CONDUCTOR', FALSE),
    ('TRAINING_PARTICIPANT', 'EXCUSE_READER', 'NOTIFIED', 'SELF', TRUE),
    ('TRAINING_PARTICIPANT', 'EXCUSE_READER', 'IN_PROGRESS', 'CONDUCTOR', FALSE),
    ('TRAINING_PARTICIPANT', 'EXCUSE_READER', 'IN_PROGRESS', 'SELF', TRUE),
    ('TRAINING_PARTICIPANT', 'CORRECT_ATTENDANCE', 'IN_PROGRESS', 'CONDUCTOR', FALSE),
    ('TRAINING_PARTICIPANT', 'CORRECT_ATTENDANCE', 'IN_PROGRESS', 'SELF', TRUE),
    ('TRAINING_PARTICIPANT', 'SET_PARTICIPATION', 'PLANNED', 'CONDUCTOR', FALSE),
    ('TRAINING_PARTICIPANT', 'SET_PARTICIPATION', 'PLANNED', 'SELF', TRUE),
    ('TRAINING_PARTICIPANT', 'SET_PARTICIPATION', 'NOTIFIED', 'CONDUCTOR', FALSE),
    ('TRAINING_PARTICIPANT', 'SET_PARTICIPATION', 'NOTIFIED', 'SELF', TRUE),
    ('TRAINING_PARTICIPANT', 'SET_PARTICIPATION', 'IN_PROGRESS', 'CONDUCTOR', FALSE),
    ('TRAINING_PARTICIPANT', 'SET_PARTICIPATION', 'IN_PROGRESS', 'SELF', TRUE),
    ('TRAINING_PARTICIPANT', 'CONFIRM_READ', 'NOTIFIED', 'SELF', FALSE),
    ('TRAINING_PARTICIPANT', 'CONFIRM_READ', 'IN_PROGRESS', 'SELF', FALSE),
    ('TRAINING_ASSESSMENT', 'APPROVE', 'PENDING_APPROVAL', 'CREATOR', TRUE),
    ('TRAINING_ASSESSMENT', 'APPROVE', 'PENDING_APPROVAL', 'UPDATER', TRUE),
    ('TRAINING_ASSESSMENT', 'APPROVE', 'PENDING_APPROVAL', 'SUBMITTER', TRUE),
    ('TRAINING_ASSESSMENT', 'RETURN_TO_DRAFT', 'PENDING_APPROVAL', 'DESIGNER_OR_APPROVER', FALSE),
    ('TRAINING_JOB_ASSIGNMENT', 'APPROVE_EXCEPTION', 'DRAFT', 'EXCEPTION_ASSIGNEE', FALSE),
    ('TRAINING_JOB_ASSIGNMENT', 'APPROVE_EXCEPTION', 'DRAFT', 'RECEIVER', TRUE),
    ('TRAINING_JOB_ASSIGNMENT', 'APPROVE_EXCEPTION', 'DRAFT', 'CREATOR', TRUE),
    ('TRAINING_JOB_ASSIGNMENT', 'SUBMIT', 'DRAFT', 'RECEIVER', TRUE),
    ('TRAINING_JOB_ASSIGNMENT', 'ACCEPT', 'PENDING_RECEIVER', 'RECEIVER', FALSE),
    ('TRAINING_PERSONNEL_REVIEW', 'CLOSE', 'OPEN', 'CLOSER_OK', FALSE),
    ('TRAINING_PERSONNEL_REVIEW', 'CLOSE', 'OPEN', 'SUBJECT', TRUE),
    ('TRAINING_PERSONNEL_REVIEW', 'CHANGE_CLOSER', 'OPEN', 'REASSIGN_RIGHT', FALSE),
    ('TRAINING_RECORD_EXPORT', 'APPROVE', 'PENDING_APPROVAL', 'APPROVAL_ASSIGNEE', FALSE),
    ('TRAINING_RECORD_EXPORT', 'APPROVE', 'PENDING_APPROVAL', 'PREPARER', TRUE),
    ('TRAINING_RECORD_EXPORT', 'REJECT', 'PENDING_APPROVAL', 'APPROVAL_ASSIGNEE', FALSE),
    ('TRAINING_RECORD_EXPORT', 'REJECT', 'PENDING_APPROVAL', 'PREPARER', TRUE),
    ('TRAINING_RECORD_EXPORT_BATCH', 'APPROVE', 'PENDING_APPROVAL', 'APPROVAL_ASSIGNEE', FALSE),
    ('TRAINING_RECORD_EXPORT_BATCH', 'APPROVE', 'PENDING_APPROVAL', 'PREPARER', TRUE),
    ('TRAINING_RECORD_EXPORT_BATCH', 'REJECT', 'PENDING_APPROVAL', 'APPROVAL_ASSIGNEE', FALSE),
    ('TRAINING_RECORD_EXPORT_BATCH', 'REJECT', 'PENDING_APPROVAL', 'PREPARER', TRUE),
    ('TRAINING_TRAINER_EXCEPTION', 'APPROVE', 'PENDING', 'APPROVAL_ASSIGNEE', FALSE),
    ('TRAINING_TRAINER_EXCEPTION', 'APPROVE', 'PENDING', 'REQUESTER', TRUE),
    ('TRAINING_TRAINER_EXCEPTION', 'APPROVE', 'PENDING', 'TRAINER', TRUE),
    ('TRAINING_TRAINER_EXCEPTION', 'REJECT', 'PENDING', 'APPROVAL_ASSIGNEE', FALSE),
    ('TRAINING_TRAINER_EXCEPTION', 'REJECT', 'PENDING', 'REQUESTER', TRUE),
    ('TRAINING_TRAINER_EXCEPTION', 'REJECT', 'PENDING', 'TRAINER', TRUE),
    ('TRAINING_SUSPENSION', 'RESUME', 'OPEN', 'SUBJECT', TRUE),
    ('TRAINING_VENDOR', 'APPROVE', 'DRAFT', 'CREATOR', TRUE),
    ('TRAINING_RECORD', 'VOID', 'ACTIVE', 'CONFIRMER', TRUE)
) AS r(object_type, action_code, from_status, relation_code, forbidden)
JOIN workflow_action_policies p ON p.module_key = 'TRAINING' AND p.object_type = r.object_type AND p.action_code = r.action_code AND p.from_status = r.from_status
JOIN authorization_relation_definitions d ON d.code = r.relation_code AND d.resource_type = r.object_type
ON CONFLICT (policy_id, relation_definition_id) DO NOTHING;
