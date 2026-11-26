-- V860: the permissions of the Training Assessments library are four: view, manage (what a person created), manage_all (every assessment) and approve.
-- Owner decision (DEC-TRAIN-2026-11-25-01): the single "design" permission is replaced. A person who held it now holds "manage", so nobody gets wider rights by this change;
-- "manage_all" and "view" are new and are given by hand. Approving stays apart: manage_all does not approve, and the rule that the approver is not the person who created, changed or sent
-- the assessment is unchanged. The assessment library has no department; the activity that uses an assessment already belongs to a department or to all.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), v.code, v.name, 'Training Management', 'training', 'training_assessment', v.description, v.display_order, TRUE
FROM (VALUES
    ('training.assessment.view',       'View Training Assessments',        'See the tests and checklists of the Training Assessments library and their paper. Changes nothing.', 245),
    ('training.assessment.manage',     'Manage Own Training Assessments',  'Create Training Assessments, and change, delete, send for approval or give a new revision to the ones this person created. Does not approve them.', 248),
    ('training.assessment.manage_all', 'Manage All Training Assessments',  'Create Training Assessments, and change, delete, send for approval or give a new revision to any of them, whoever created it. Does not approve them.', 249)
) AS v(code, name, description, display_order)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

-- what a holder of "design" had is what "manage" gives
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), i.permission_set_id, m.id
  FROM permission_set_items i
  JOIN permissions d ON d.id = i.permission_id AND d.code = 'training.assessment.design'
  JOIN permissions m ON m.code = 'training.assessment.manage'
 WHERE NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = i.permission_set_id AND x.permission_id = m.id);

-- the relation that says "this person may manage this assessment": the permission manage_all, or the permission manage on an assessment the person created (the adapter works it out)
INSERT INTO authorization_relation_definitions (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version, created_at, updated_at)
SELECT gen_random_uuid(), 'CAN_MANAGE', 'May manage the assessment', 'TRAINING_ASSESSMENT', 'WORKFLOW_PARTICIPANT', '{"participantType": "CAN_MANAGE"}'::jsonb,
       'A person who holds manage_all of the assessments, or manage and created this assessment.', TRUE, 0, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM authorization_relation_definitions d WHERE d.code = 'CAN_MANAGE' AND d.resource_type = 'TRAINING_ASSESSMENT');

UPDATE authorization_relation_definitions
   SET description = 'A person who may manage the assessment, or who holds the approve permission of assessments.'
 WHERE code = 'DESIGNER_OR_APPROVER' AND resource_type = 'TRAINING_ASSESSMENT';

-- the four steps of the designer are decided by that relation alone (no permission of the step)
DELETE FROM workflow_action_policy_actors a
 USING workflow_action_policies p
 WHERE a.policy_id = p.id AND p.module_key = 'TRAINING' AND p.object_type = 'TRAINING_ASSESSMENT'
   AND p.action_code IN ('UPDATE', 'DELETE', 'SUBMIT', 'UPGRADE_REVISION')
   AND a.actor_type = 'PERMISSION' AND a.actor_code = 'training.assessment.design';

UPDATE workflow_action_policies
   SET required_permission_code = '', relation_match_rule = 'ANY', updated_at = now(), version = version + 1,
       description = CASE action_code
           WHEN 'UPDATE' THEN 'A person who may manage the assessment (all of them, or the ones they created) edits a draft assessment.'
           WHEN 'DELETE' THEN 'A person who may manage the assessment deletes a draft assessment, with a reason.'
           WHEN 'SUBMIT' THEN 'A person who may manage the assessment submits a draft with at least one item for approval.'
           ELSE 'A person who may manage the assessment starts a new revision of an effective assessment.' END
 WHERE module_key = 'TRAINING' AND object_type = 'TRAINING_ASSESSMENT'
   AND action_code IN ('UPDATE', 'DELETE', 'SUBMIT', 'UPGRADE_REVISION');

INSERT INTO workflow_action_policy_relations (id, policy_id, relation_definition_id, require_sequence, priority, active, forbidden)
SELECT gen_random_uuid(), p.id, d.id, FALSE, 100, TRUE, r.forbidden
FROM (VALUES
    ('TRAINING_ASSESSMENT', 'UPDATE', 'DRAFT', 'CAN_MANAGE', FALSE),
    ('TRAINING_ASSESSMENT', 'DELETE', 'DRAFT', 'CAN_MANAGE', FALSE),
    ('TRAINING_ASSESSMENT', 'SUBMIT', 'DRAFT', 'CAN_MANAGE', FALSE),
    ('TRAINING_ASSESSMENT', 'UPGRADE_REVISION', 'EFFECTIVE', 'CAN_MANAGE', FALSE)
) AS r(object_type, action_code, from_status, relation_code, forbidden)
JOIN workflow_action_policies p ON p.module_key = 'TRAINING' AND p.object_type = r.object_type AND p.action_code = r.action_code AND p.from_status = r.from_status
JOIN authorization_relation_definitions d ON d.code = r.relation_code AND d.resource_type = r.object_type
ON CONFLICT (policy_id, relation_definition_id) DO NOTHING;

-- the old permission is retired
DELETE FROM permission_set_items i USING permissions d WHERE d.id = i.permission_id AND d.code = 'training.assessment.design';
DELETE FROM permissions WHERE code = 'training.assessment.design';
