-- Owner decision DEC-WORKFLOW-DIAGRAM-2026-11-27 (5): the Administrator profile sees and edits the workflow diagrams of both modules. The four permissions are
-- added to the permission set of that profile that holds its own additions; no other profile receives them here.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), s.id, p.id
  FROM permission_sets s
  JOIN access_profile_permission_sets aps ON aps.permission_set_id = s.id
  JOIN roles r ON r.id = aps.access_profile_id AND r.code = 'ADMINISTRATOR'
  JOIN permissions p ON p.code IN ('documents.workflow_diagram.view', 'documents.workflow_diagram.manage',
                                   'training.workflow_diagram.view', 'training.workflow_diagram.manage')
 WHERE s.name = 'Administrator managed permissions'
   AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = s.id AND x.permission_id = p.id);
