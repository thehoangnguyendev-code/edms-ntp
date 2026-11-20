-- V810: Training joins Workflow Authorization with its first two lifecycles, the Requirement (SOP) and the Matrix version (phase C of AUTHORIZATION_SYSTEM_WIDE_HYBRID_PLAN_2026_11_15;
-- owner decision 2026-11-18: every row of AUTHORIZATION_ACTION_CATALOG_TRAINING_AS_IS_2026_11_18 is approved as it is in code).
-- The rows say what TrainingRequirementService and TrainingMatrixService have always checked, so that the engine can decide it in the shadow, the screens can show it, and an administrator
-- can see which person is kept apart. Nothing changes in who may do what.

-- 1. The relations of a requirement and of a matrix version that the steps care about (resolved by the adapters from the record and from training_approval_assignments)
INSERT INTO authorization_relation_definitions (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version, created_at, updated_at)
SELECT gen_random_uuid(), v.code, v.display_name, v.resource_type, 'WORKFLOW_PARTICIPANT', v.config::jsonb, v.description, TRUE, 0, now(), now()
FROM (VALUES
    ('PREPARER',          'Preparer',                  'TRAINING_REQUIREMENT',    '{"participantType": "PREPARER"}',          'The person who prepared and submitted the requirement.'),
    ('REVIEWED_BY',       'Reviewer (done)',           'TRAINING_REQUIREMENT',    '{"participantType": "REVIEWER_DONE"}',     'The person who reviewed the requirement.'),
    ('REVIEW_ASSIGNEE',   'Designated reviewer',       'TRAINING_REQUIREMENT',    '{"participantType": "REVIEW_ASSIGNEE"}',   'The person designated to review the requirement and not yet done.'),
    ('APPROVAL_ASSIGNEE', 'Designated approver',       'TRAINING_REQUIREMENT',    '{"participantType": "APPROVAL_ASSIGNEE"}', 'The person designated to approve the requirement.'),
    ('PREPARER',          'Preparer',                  'TRAINING_MATRIX_VERSION', '{"participantType": "PREPARER"}',          'The person who prepared and submitted the matrix version.'),
    ('APPROVAL_ASSIGNEE', 'Designated approver',       'TRAINING_MATRIX_VERSION', '{"participantType": "APPROVAL_ASSIGNEE"}', 'The person designated to approve the matrix version.')
) AS v(code, display_name, resource_type, config, description)
WHERE NOT EXISTS (SELECT 1 FROM authorization_relation_definitions d WHERE d.code = v.code AND d.resource_type = v.resource_type);

-- 2. The policies. action, from status, permission, workflow, object type, description
WITH inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description, relation_match_rule, created_at, updated_at, version)
    SELECT gen_random_uuid(), 'TRAINING', v.workflow, v.object_type, v.action_code, v.from_status,
           v.permission, 100, TRUE, TRUE, v.description, 'ANY', now(), now(), 0
    FROM (VALUES
        ('TRAINING_REQUIREMENT', 'TRAINING_REQUIREMENT', 'SUBMIT',  'DRAFT',            'training.requirement.prepare', 'A person who prepares requirements, in the department of the requirement, sends a draft with at least one line for review.'),
        ('TRAINING_REQUIREMENT', 'TRAINING_REQUIREMENT', 'REVIEW',  'PENDING_REVIEW',   'training.requirement.review',  'The person designated to review, who did not prepare the requirement, reviews it and sends it for approval.'),
        ('TRAINING_REQUIREMENT', 'TRAINING_REQUIREMENT', 'APPROVE', 'PENDING_APPROVAL','training.requirement.approve', 'The person designated to approve, who neither prepared nor reviewed the requirement, approves it.'),
        ('TRAINING_REQUIREMENT', 'TRAINING_REQUIREMENT', 'REJECT',  'PENDING_REVIEW',   'training.requirement.review',  'The person designated to review sends the requirement back to Draft with a reason.'),
        ('TRAINING_REQUIREMENT', 'TRAINING_REQUIREMENT', 'REJECT',  'PENDING_APPROVAL','training.requirement.approve', 'The person designated to approve sends the requirement back to Draft with a reason.'),
        ('TRAINING_MATRIX',      'TRAINING_MATRIX_VERSION', 'SUBMIT',  'DRAFT',            'training.matrix.manage',   'A person who manages matrices, in the department of the matrix, sends a complete draft version for approval.'),
        ('TRAINING_MATRIX',      'TRAINING_MATRIX_VERSION', 'APPROVE', 'PENDING_APPROVAL','training.matrix.approve',  'The person designated to approve, who did not prepare the version, approves it and it becomes the effective version.'),
        ('TRAINING_MATRIX',      'TRAINING_MATRIX_VERSION', 'REJECT',  'PENDING_APPROVAL','training.matrix.approve',  'The person designated to approve sends the version back to Draft with a reason.')
    ) AS v(workflow, object_type, action_code, from_status, permission, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies p
        WHERE p.module_key = 'TRAINING' AND p.workflow_key = v.workflow AND p.object_type = v.object_type
          AND p.action_code = v.action_code AND p.from_status = v.from_status AND p.document_type_id IS NULL)
    RETURNING id, required_permission_code
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), i.id, 'PERMISSION', i.required_permission_code, now() FROM inserted i;

-- 3. Required and forbidden relations of each policy
-- (policy action, from status, object type) -> relation code, forbidden?
INSERT INTO workflow_action_policy_relations (id, policy_id, relation_definition_id, require_sequence, priority, active, forbidden)
SELECT gen_random_uuid(), p.id, d.id, FALSE, 100, TRUE, r.forbidden
FROM (VALUES
    ('TRAINING_REQUIREMENT', 'REVIEW',  'PENDING_REVIEW',    'REVIEW_ASSIGNEE',   FALSE),
    ('TRAINING_REQUIREMENT', 'REVIEW',  'PENDING_REVIEW',    'PREPARER',          TRUE),
    ('TRAINING_REQUIREMENT', 'REJECT',  'PENDING_REVIEW',    'REVIEW_ASSIGNEE',   FALSE),
    ('TRAINING_REQUIREMENT', 'REJECT',  'PENDING_REVIEW',    'PREPARER',          TRUE),
    ('TRAINING_REQUIREMENT', 'APPROVE', 'PENDING_APPROVAL',  'APPROVAL_ASSIGNEE', FALSE),
    ('TRAINING_REQUIREMENT', 'APPROVE', 'PENDING_APPROVAL',  'PREPARER',          TRUE),
    ('TRAINING_REQUIREMENT', 'APPROVE', 'PENDING_APPROVAL',  'REVIEWED_BY',       TRUE),
    ('TRAINING_REQUIREMENT', 'APPROVE', 'PENDING_APPROVAL',  'REVIEW_ASSIGNEE',   TRUE),
    ('TRAINING_REQUIREMENT', 'REJECT',  'PENDING_APPROVAL',  'APPROVAL_ASSIGNEE', FALSE),
    ('TRAINING_REQUIREMENT', 'REJECT',  'PENDING_APPROVAL',  'PREPARER',          TRUE),
    ('TRAINING_REQUIREMENT', 'REJECT',  'PENDING_APPROVAL',  'REVIEWED_BY',       TRUE),
    ('TRAINING_REQUIREMENT', 'REJECT',  'PENDING_APPROVAL',  'REVIEW_ASSIGNEE',   TRUE),
    ('TRAINING_MATRIX_VERSION', 'APPROVE', 'PENDING_APPROVAL', 'APPROVAL_ASSIGNEE', FALSE),
    ('TRAINING_MATRIX_VERSION', 'APPROVE', 'PENDING_APPROVAL', 'PREPARER',          TRUE),
    ('TRAINING_MATRIX_VERSION', 'REJECT',  'PENDING_APPROVAL', 'APPROVAL_ASSIGNEE', FALSE),
    ('TRAINING_MATRIX_VERSION', 'REJECT',  'PENDING_APPROVAL', 'PREPARER',          TRUE)
) AS r(object_type, action_code, from_status, relation_code, forbidden)
JOIN workflow_action_policies p ON p.module_key = 'TRAINING' AND p.object_type = r.object_type AND p.action_code = r.action_code AND p.from_status = r.from_status
JOIN authorization_relation_definitions d ON d.code = r.relation_code AND d.resource_type = r.object_type
ON CONFLICT (policy_id, relation_definition_id) DO NOTHING;
