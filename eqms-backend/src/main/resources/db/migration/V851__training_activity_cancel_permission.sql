-- Owner decision 2026-11-25 (DEC-TRAINING-2026-11-25-3): Cancel of a Training Activity has its own permission, as Cancel has in Document Control (documents.document.cancel), and is taken only by the
-- people of the department that organizes the training. Everybody who holds the permission to organize trainings today also gets the permission to cancel, so nobody loses a right by this change.
-- Forward-only and idempotent. Rollback (if needed): set the five policies back to training.activity.organize and delete the permission.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'training.activity.cancel', 'Cancel Training Activity',
     'Training Management', 'training', 'training_activity',
     'Cancels a training activity of the department with a reason and a signature, unless somebody already passed. Not for the training of a document revision.', 243, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), psi.permission_set_id, c.id
  FROM permission_set_items psi
  JOIN permissions o ON o.id = psi.permission_id AND o.code = 'training.activity.organize'
  CROSS JOIN permissions c
 WHERE c.code = 'training.activity.cancel'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

UPDATE workflow_action_policies p
   SET required_permission_code = v.permission_code, description = v.description
  FROM (VALUES
    ('CANCEL', 'PLANNED', 'training.activity.cancel', 'A person of the department who may cancel trainings cancels the activity with a reason and a signature, unless somebody already passed or the training is the training of a document revision.'),
    ('CANCEL', 'PENDING_APPROVAL', 'training.activity.cancel', 'A person of the department who may cancel trainings cancels the activity with a reason and a signature, unless somebody already passed or the training is the training of a document revision.'),
    ('CANCEL', 'NOTIFIED', 'training.activity.cancel', 'A person of the department who may cancel trainings cancels the activity with a reason and a signature, unless somebody already passed or the training is the training of a document revision.'),
    ('CANCEL', 'IN_PROGRESS', 'training.activity.cancel', 'A person of the department who may cancel trainings cancels the activity with a reason and a signature, unless somebody already passed or the training is the training of a document revision.'),
    ('CANCEL', 'PENDING_QA_CONFIRMATION', 'training.activity.cancel', 'A person of the department who may cancel trainings cancels the activity with a reason and a signature, unless somebody already passed or the training is the training of a document revision.')
  ) AS v(action_code, from_status, permission_code, description)
 WHERE p.module_key = 'TRAINING' AND p.workflow_key = 'TRAINING_ACTIVITY' AND p.object_type = 'TRAINING_ACTIVITY'
   AND p.action_code = v.action_code AND p.from_status = v.from_status;
