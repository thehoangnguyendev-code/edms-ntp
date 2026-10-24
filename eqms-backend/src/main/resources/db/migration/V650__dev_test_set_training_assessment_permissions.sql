-- DEV only: the permission set "Report Author and Administrator (DEV test)" is the one that gives the DEV test accounts their Training permissions. It gets the two permissions of the Training Assessments
-- library so that the menu is available to them. The set exists only on the DEV database: where it does not exist this does nothing.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
  FROM permission_sets ps
  JOIN permissions p ON p.code IN ('training.assessment.design', 'training.assessment.approve')
 WHERE ps.name = 'Report Author and Administrator (DEV test)'
   AND NOT EXISTS (SELECT 1 FROM permission_set_items i WHERE i.permission_set_id = ps.id AND i.permission_id = p.id);
