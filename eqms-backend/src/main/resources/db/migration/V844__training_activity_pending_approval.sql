-- V844: Training Activity gets the status PENDING APPROVAL between Planned and Notified, and the content is approved by two people in turn (owner decision 2026-11-23,
-- DEC-TRAINING-2026-11-23-10; SOP.0003 5.3.5 names two roles: the head of the unit concerned and the head of QA). This is phase 1: states, the choice of the two approvers, Submit for
-- Approval, the first and the second approval, Reject. Sending the notifications, Prepare Training and Start Training follow in phase 2.
--
-- 1. The status. Machine value PENDING_APPROVAL; the label is read by the screens from training_activity_statuses.
-- 2. The two approvers chosen by the organizer are stored (Save), so leaving the screen and coming back keeps them: one row per activity, the first and the second person.
-- 3. The first approval is a step of its own (CONTENT_APPROVE_FIRST); the second one is the step that already existed (CONTENT_APPROVE), so every gate that reads the confirmation
--    CONTENT_APPROVED still means "both approved". Two new meanings for the electronic signature: submitting for approval and rejecting.
-- 4. Workflow Authorization: the policies of CONTENT_APPROVE from Planned and Notified and of REOPEN_CONTENT from Planned can no longer be reached and are removed (NOTIFY from Planned stays: an
--    external training has no content to approve and is notified from Planned);
--    the policies of the new course are added (SUBMIT_FOR_APPROVAL, CONTENT_APPROVE_FIRST, CONTENT_APPROVE, CONTENT_REJECT, NOTIFY, CANCEL and REOPEN_CONTENT from PENDING_APPROVAL).
-- 5. Data already on DEV: an activity that was Planned with the content approved becomes Pending Approval (it is approved and waits to be notified); an approval that was designated and not signed
--    is cancelled with a reason (the organizer chooses the two approvers again and submits).
--
-- Rollback (if needed): set the activities in PENDING_APPROVAL back to PLANNED, restore the constraint without PENDING_APPROVAL, re-insert the removed policies as V811/V816/V843 inserted them,
-- and drop training_activity_approvers. Signatures, confirmations and the Audit Trail are never deleted by this migration.

ALTER TABLE training_activities DROP CONSTRAINT IF EXISTS training_activities_status_check;
ALTER TABLE training_activities ADD CONSTRAINT training_activities_status_check
    CHECK (status IN ('RESERVED','PLANNED','PENDING_APPROVAL','NOTIFIED','IN_PROGRESS','PENDING_QA_CONFIRMATION','COMPLETED','CANCELLED'));

UPDATE training_activity_statuses SET sort_order = sort_order + 1 WHERE code IN ('NOTIFIED','IN_PROGRESS','PENDING_QA_CONFIRMATION','COMPLETED','CANCELLED') AND sort_order >= 3
    AND NOT EXISTS (SELECT 1 FROM training_activity_statuses WHERE code = 'PENDING_APPROVAL');
INSERT INTO training_activity_statuses(code, label, sort_order) VALUES ('PENDING_APPROVAL', 'Pending Approval', 3) ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS training_activity_approvers (
    activity_id    UUID PRIMARY KEY REFERENCES training_activities(id) ON DELETE CASCADE,
    first_user_id  UUID NOT NULL REFERENCES app_users(id),
    second_user_id UUID NOT NULL REFERENCES app_users(id),
    saved_by       UUID REFERENCES app_users(id),
    saved_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (first_user_id <> second_user_id)
);

ALTER TABLE training_activity_confirmations DROP CONSTRAINT IF EXISTS training_activity_confirmations_kind_check;
ALTER TABLE training_activity_confirmations ADD CONSTRAINT training_activity_confirmations_kind_check
    CHECK (kind IN ('ATTENDEE_LIST_PREPARED','TRAINER_ATTENDANCE','HEAD_SELF_READING','CONTENT_REVIEWED','CONTENT_APPROVED_FIRST','CONTENT_APPROVED','QA_COMPLETION'));

INSERT INTO training_approval_modes (step_code, designation_mode) VALUES ('CONTENT_APPROVE_FIRST', 'DESIGNATED_REQUIRED') ON CONFLICT (step_code) DO NOTHING;

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), v.code, v.name
FROM (VALUES
 ('TRAINING_CONTENT_SUBMITTED', 'Training Content Submitted for Approval', 'The organizer submits the content and the test of a training activity for approval by the head of the unit and the head of QA.'),
 ('TRAINING_CONTENT_REJECTED',  'Training Content Rejected',               'An approver rejects the content or the test of a training activity, with a reason; the activity returns to Planned.')
) AS v(code, name, descr)
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = v.code);

INSERT INTO authorization_relation_definitions (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version, created_at, updated_at)
SELECT gen_random_uuid(), 'CONTENT_APPROVE_FIRST_ASSIGNEE', 'Designated first content approver', 'TRAINING_ACTIVITY', 'WORKFLOW_PARTICIPANT',
       '{"participantType": "CONTENT_APPROVE_FIRST_ASSIGNEE"}'::jsonb, 'The person designated to approve the content first and not yet done.', TRUE, 0, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM authorization_relation_definitions d WHERE d.code = 'CONTENT_APPROVE_FIRST_ASSIGNEE' AND d.resource_type = 'TRAINING_ACTIVITY');

-- the policies that cannot be reached any more
DELETE FROM workflow_action_policy_relations relation USING workflow_action_policies policy
 WHERE relation.policy_id = policy.id AND policy.module_key = 'TRAINING' AND policy.workflow_key = 'TRAINING_ACTIVITY' AND policy.object_type = 'TRAINING_ACTIVITY'
   AND ((policy.action_code = 'CONTENT_APPROVE' AND policy.from_status IN ('PLANNED','NOTIFIED'))
     OR (policy.action_code = 'REOPEN_CONTENT' AND policy.from_status = 'PLANNED'));
DELETE FROM workflow_action_policy_actors actor USING workflow_action_policies policy
 WHERE actor.policy_id = policy.id AND policy.module_key = 'TRAINING' AND policy.workflow_key = 'TRAINING_ACTIVITY' AND policy.object_type = 'TRAINING_ACTIVITY'
   AND ((policy.action_code = 'CONTENT_APPROVE' AND policy.from_status IN ('PLANNED','NOTIFIED'))
     OR (policy.action_code = 'REOPEN_CONTENT' AND policy.from_status = 'PLANNED'));
DELETE FROM workflow_action_policies
 WHERE module_key = 'TRAINING' AND workflow_key = 'TRAINING_ACTIVITY' AND object_type = 'TRAINING_ACTIVITY'
   AND ((action_code = 'CONTENT_APPROVE' AND from_status IN ('PLANNED','NOTIFIED'))
     OR (action_code = 'REOPEN_CONTENT' AND from_status = 'PLANNED'));

-- the policies of the new course
WITH inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description, relation_match_rule, created_at, updated_at, version)
    SELECT gen_random_uuid(), 'TRAINING', 'TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', v.action_code, v.from_status, v.permission, 100, TRUE, TRUE, v.description, 'ANY', now(), now(), 0
    FROM (VALUES
        ('SUBMIT_FOR_APPROVAL', 'PLANNED', 'training.activity.organize', 'An organizer submits the content and the test for approval, with a signature, once the two approvers are chosen and saved.'),
        ('CONTENT_APPROVE_FIRST', 'PENDING_APPROVAL', 'training.content.approve', 'The person designated to approve first, who did not create the activity, signs the first approval.'),
        ('CONTENT_APPROVE', 'PENDING_APPROVAL', 'training.content.approve', 'The person designated to approve second, after the first approval, who did not create the activity, signs the second approval.'),
        ('CONTENT_REJECT', 'PENDING_APPROVAL', 'training.content.approve', 'The approver whose turn it is rejects the content with a reason and a signature; the activity returns to Planned.'),
        ('NOTIFY', 'PENDING_APPROVAL', 'training.activity.organize', 'An organizer notifies the participants once both approvers have signed and the list is confirmed.'),
        ('CANCEL', 'PENDING_APPROVAL', 'training.activity.organize', 'An organizer cancels the activity with a reason and a signature, unless somebody already passed.'),
        ('REOPEN_CONTENT', 'PENDING_APPROVAL', 'training.activity.organize', 'An organizer takes the content back to edit it (Edit Content), with a reason and a signature; the approvals start again.')
    ) AS v(action_code, from_status, permission, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies p
        WHERE p.module_key = 'TRAINING' AND p.workflow_key = 'TRAINING_ACTIVITY' AND p.object_type = 'TRAINING_ACTIVITY'
          AND p.action_code = v.action_code AND p.from_status = v.from_status AND p.document_type_id IS NULL)
    RETURNING id, required_permission_code
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), i.id, 'PERMISSION', i.required_permission_code, now() FROM inserted i WHERE i.required_permission_code <> '';

INSERT INTO workflow_action_policy_relations (id, policy_id, relation_definition_id, require_sequence, priority, active, forbidden)
SELECT gen_random_uuid(), p.id, d.id, FALSE, 100, TRUE, r.forbidden
FROM (VALUES
    ('CONTENT_APPROVE_FIRST', 'PENDING_APPROVAL', 'CONTENT_APPROVE_FIRST_ASSIGNEE', FALSE),
    ('CONTENT_APPROVE_FIRST', 'PENDING_APPROVAL', 'CONTENT_CREATOR', TRUE),
    ('CONTENT_APPROVE', 'PENDING_APPROVAL', 'CONTENT_APPROVE_ASSIGNEE', FALSE),
    ('CONTENT_APPROVE', 'PENDING_APPROVAL', 'CONTENT_CREATOR', TRUE)
) AS r(action_code, from_status, relation_code, forbidden)
JOIN workflow_action_policies p ON p.module_key = 'TRAINING' AND p.object_type = 'TRAINING_ACTIVITY' AND p.action_code = r.action_code AND p.from_status = r.from_status
JOIN authorization_relation_definitions d ON d.code = r.relation_code AND d.resource_type = 'TRAINING_ACTIVITY'
ON CONFLICT (policy_id, relation_definition_id) DO NOTHING;

-- data already there: approved and waiting to be notified -> Pending Approval; designated but not signed -> cancelled
UPDATE training_activities a SET status = 'PENDING_APPROVAL', updated_at = now(), version = version + 1
 WHERE a.status = 'PLANNED'
   AND EXISTS (SELECT 1 FROM training_active_confirmations c WHERE c.activity_id = a.id AND c.kind = 'CONTENT_APPROVED');
UPDATE training_approval_assignments
   SET status = 'CANCELLED', completed_at = now(),
       reason = 'The content is now approved by two people in turn (2026-11-23): the organizer chooses the two approvers again and submits for approval'
 WHERE object_type = 'TRAINING_ACTIVITY' AND step_code = 'CONTENT_APPROVE' AND status = 'PENDING';
