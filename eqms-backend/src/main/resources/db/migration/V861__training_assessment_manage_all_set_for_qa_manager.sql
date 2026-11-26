-- V861: a Permission Set that carries manage_all of the Training Assessments (V860), and the sample profile "Training - QA Manager" gets it (owner request: the QA account manages every assessment).
-- Nothing is granted to a person by this: the profile has no user until an Administrator assigns it. The set holds manage_all and view only; it does NOT carry approve, so the person who
-- manages the assessments does not approve them with it (the approval stays a set of its own, and the rule "not the person who created, changed or sent it" applies in any case).
-- Idempotent: a set, item or link that already exists is left as it is.

INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), 'Training - Assessment Manage All', 'TRAINING_ASSESSMENT_MANAGE_ALL',
       'Creates and changes, deletes, sends for approval and gives a new revision to every Training Assessment, whoever created it. Does not approve.', true, false
WHERE NOT EXISTS (SELECT 1 FROM permission_sets existing WHERE existing.code = 'TRAINING_ASSESSMENT_MANAGE_ALL');

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM (VALUES
    ('TRAINING_ASSESSMENT_MANAGE_ALL', 'training.assessment.view'),
    ('TRAINING_ASSESSMENT_MANAGE_ALL', 'training.assessment.manage_all')
) AS v(set_code, permission_code)
JOIN permission_sets ps ON ps.code = v.set_code
JOIN permissions p ON p.code = v.permission_code
WHERE NOT EXISTS (SELECT 1 FROM permission_set_items existing WHERE existing.permission_set_id = ps.id AND existing.permission_id = p.id);

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
SELECT r.id, ps.id
FROM roles r
JOIN permission_sets ps ON ps.code = 'TRAINING_ASSESSMENT_MANAGE_ALL'
WHERE r.code = 'TRN_QA_MANAGER'
  AND NOT EXISTS (SELECT 1 FROM access_profile_permission_sets existing WHERE existing.access_profile_id = r.id AND existing.permission_set_id = ps.id);
