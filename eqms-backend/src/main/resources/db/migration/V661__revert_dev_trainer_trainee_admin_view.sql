-- V660 gave training.admin.view to the DEV test sets of the trainer and the trainee so that TrainingAdministrationPermissionTest passes. That rule leads to four more permissions (the sub-screens of Training
-- Administration: properties, requirement templates, quiz, curriculums), and the roles are meant to show what a trainer and a trainee can NOT do. The grant is taken back; what to do with the two sets
-- is a decision of the owner (either the sets get the whole chain, or the test excludes the DEV test roles).
DELETE FROM permission_set_items i
 USING permission_sets ps, permissions p
 WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
   AND ps.name IN ('Training Trainer (DEV test)', 'Training Trainee (DEV test)')
   AND p.code = 'training.admin.view';
