-- Cancel is a Draft-only disposition, never a substitute for Reject.
-- Preserve prior configuration rows for auditability but retire them from evaluation.
UPDATE workflow_action_policies
SET active = FALSE,
    updated_at = now()
WHERE module_key = 'DOCUMENT_CONTROL'
  AND workflow_key = 'DOCUMENT_REVISION'
  AND object_type = 'REVISION'
  AND action_code = 'CANCEL'
  AND active = TRUE;

WITH ins AS (
    INSERT INTO workflow_action_policies (
        module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description
    )
    SELECT 'DOCUMENT_CONTROL', 'DOCUMENT_REVISION', 'REVISION', 'CANCEL', 'DRAFT',
           'documents.revision.cancel', 100, TRUE, TRUE,
           'Author, Co-author, DCO, or Document Admin may cancel a Draft revision with an activity summary.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE module_key = 'DOCUMENT_CONTROL' AND workflow_key = 'DOCUMENT_REVISION'
          AND object_type = 'REVISION' AND action_code = 'CANCEL'
          AND from_status = 'DRAFT' AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT ins.id, actors.actor_type
FROM ins
CROSS JOIN (VALUES ('AUTHOR'), ('CO_AUTHOR'), ('DCO'), ('DOCUMENT_ADMIN')) AS actors(actor_type);

WITH ins AS (
    INSERT INTO workflow_action_policies (
        module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description
    )
    SELECT 'DOCUMENT_CONTROL', 'DOCUMENT_REVISION', 'REVISION', 'OBSOLETE', 'EFFECTIVE',
           'documents.revision.obsolete', 100, TRUE, TRUE,
           'DCO or Document Admin may obsolete an Effective revision with an activity summary and electronic signature.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE module_key = 'DOCUMENT_CONTROL' AND workflow_key = 'DOCUMENT_REVISION'
          AND object_type = 'REVISION' AND action_code = 'OBSOLETE'
          AND from_status = 'EFFECTIVE' AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT ins.id, actors.actor_type
FROM ins
CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_ADMIN')) AS actors(actor_type);

-- Make the Draft cancel action available to the two standard authoring permission sets.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'documents.revision.cancel'
WHERE ps.code IN ('PS_DOCUMENT_AUTHOR', 'PS_DOCUMENT_COAUTHOR')
  AND NOT EXISTS (
      SELECT 1 FROM permission_set_items existing
      WHERE existing.permission_set_id = ps.id AND existing.permission_id = p.id
  );

UPDATE permissions
SET description = CASE code
    WHEN 'documents.revision.cancel' THEN 'Cancel an authorised Draft revision only; an activity summary and electronic signature are required.'
    WHEN 'documents.revision.obsolete' THEN 'Obsolete an authorised Effective revision only; an activity summary and electronic signature are required.'
    ELSE description
END
WHERE code IN ('documents.revision.cancel', 'documents.revision.obsolete');
