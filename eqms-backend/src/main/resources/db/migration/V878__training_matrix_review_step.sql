-- DEC-TRAINING-2026-11-27-01 (F5): SOP.0003 5.3.1 sends the training matrix "to the relevant levels for approval". A version is now reviewed by a second person before the
-- person who approves it: Draft -> Pending Review -> Pending Approval -> Effective. The reviewer holds the permission to manage matrices; the preparer, the reviewer and the
-- approver are three different people. Versions already Pending Approval, Effective or Obsoleted keep their state.
ALTER TABLE training_matrix_versions DROP CONSTRAINT IF EXISTS training_matrix_versions_status_check;
ALTER TABLE training_matrix_versions ADD CONSTRAINT training_matrix_versions_status_check CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'EFFECTIVE', 'OBSOLETED'));
ALTER TABLE training_matrix_versions ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES app_users(id);
ALTER TABLE training_matrix_versions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE training_matrix_versions ADD COLUMN IF NOT EXISTS review_signature_id uuid;

-- the content of a submitted version stays frozen while it is under review too
CREATE OR REPLACE FUNCTION training_matrix_content_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v UUID; s VARCHAR(20);
BEGIN
    IF TG_TABLE_NAME = 'training_matrix_rows' THEN
        v := COALESCE(OLD.version_id, NEW.version_id);
    ELSE
        SELECT r.version_id INTO v FROM training_matrix_rows r WHERE r.id = COALESCE(OLD.row_id, NEW.row_id);
    END IF;
    SELECT status INTO s FROM training_matrix_versions WHERE id = v;
    IF s IN ('EFFECTIVE','OBSOLETED','PENDING_REVIEW','PENDING_APPROVAL') THEN RAISE EXCEPTION 'The content of an approved or submitted matrix version cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), 'TRAINING_MATRIX_REVIEWED', 'Training Matrix Reviewed'
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = 'TRAINING_MATRIX_REVIEWED');

INSERT INTO authorization_relation_definitions (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version, created_at, updated_at)
SELECT gen_random_uuid(), v.code, v.display_name, 'TRAINING_MATRIX_VERSION', 'WORKFLOW_PARTICIPANT', v.config::jsonb, v.description, TRUE, 0, now(), now()
FROM (VALUES
    ('REVIEWED_BY',     'Reviewer (done)',     '{"participantType": "REVIEWER_DONE"}',   'The person who reviewed the matrix version.'),
    ('REVIEW_ASSIGNEE', 'Designated reviewer', '{"participantType": "REVIEW_ASSIGNEE"}', 'The person designated to review the matrix version and not yet done.')
) AS v(code, display_name, config, description)
WHERE NOT EXISTS (SELECT 1 FROM authorization_relation_definitions d WHERE d.code = v.code AND d.resource_type = 'TRAINING_MATRIX_VERSION');

WITH inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description, relation_match_rule, created_at, updated_at, version)
    SELECT gen_random_uuid(), 'TRAINING', v.workflow, v.object_type, v.action_code, v.from_status,
           v.permission, 100, TRUE, TRUE, v.description, 'ANY', now(), now(), 0
    FROM (VALUES
        ('TRAINING_MATRIX', 'TRAINING_MATRIX_VERSION', 'REVIEW', 'PENDING_REVIEW', 'training.matrix.manage', 'The person designated to review, who did not prepare the version, reviews it and sends it for approval.'),
        ('TRAINING_MATRIX', 'TRAINING_MATRIX_VERSION', 'REJECT', 'PENDING_REVIEW', 'training.matrix.manage', 'The person designated to review sends the version back to Draft with a reason.')
    ) AS v(workflow, object_type, action_code, from_status, permission, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies p
        WHERE p.module_key = 'TRAINING' AND p.workflow_key = v.workflow AND p.object_type = v.object_type
          AND p.action_code = v.action_code AND p.from_status = v.from_status AND p.document_type_id IS NULL)
    RETURNING id, required_permission_code
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), i.id, 'PERMISSION', i.required_permission_code, now() FROM inserted i;

INSERT INTO workflow_action_policy_relations (id, policy_id, relation_definition_id, require_sequence, priority, active, forbidden)
SELECT gen_random_uuid(), p.id, d.id, FALSE, 100, TRUE, r.forbidden
FROM (VALUES
    ('REVIEW',  'PENDING_REVIEW',   'REVIEW_ASSIGNEE', FALSE),
    ('REVIEW',  'PENDING_REVIEW',   'PREPARER',        TRUE),
    ('REJECT',  'PENDING_REVIEW',   'REVIEW_ASSIGNEE', FALSE),
    ('REJECT',  'PENDING_REVIEW',   'PREPARER',        TRUE),
    ('APPROVE', 'PENDING_APPROVAL', 'REVIEWED_BY',     TRUE),
    ('APPROVE', 'PENDING_APPROVAL', 'REVIEW_ASSIGNEE', TRUE),
    ('REJECT',  'PENDING_APPROVAL', 'REVIEWED_BY',     TRUE),
    ('REJECT',  'PENDING_APPROVAL', 'REVIEW_ASSIGNEE', TRUE)
) AS r(action_code, from_status, relation_code, forbidden)
JOIN workflow_action_policies p ON p.module_key = 'TRAINING' AND p.object_type = 'TRAINING_MATRIX_VERSION' AND p.action_code = r.action_code AND p.from_status = r.from_status
JOIN authorization_relation_definitions d ON d.code = r.relation_code AND d.resource_type = 'TRAINING_MATRIX_VERSION'
ON CONFLICT (policy_id, relation_definition_id) DO NOTHING;
