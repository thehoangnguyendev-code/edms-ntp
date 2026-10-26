-- "Training Providers" is called "Training Vendors" (the wording of SOP.0025): the display names of the two signature meanings follow. The codes stay.
UPDATE electronic_signature_meanings SET display_name = 'Training Vendor Approved' WHERE code = 'TRAINING_PROVIDER_APPROVED';
UPDATE electronic_signature_meanings SET display_name = 'Training Vendor Deactivated' WHERE code = 'TRAINING_PROVIDER_DEACTIVATED';

-- DEV only: the two Permission Sets of the DEV test accounts for the trainer and the trainee hold training.module.view but not training.admin.view (they were made after the backfill of V461), which
-- TrainingAdministrationPermissionTest checks. They get it so that the rule "whoever has the module view has the administration view" holds again. The sets exist only on the DEV database.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
  FROM permission_sets ps
  JOIN permissions p ON p.code = 'training.admin.view'
 WHERE ps.name IN ('Training Trainer (DEV test)', 'Training Trainee (DEV test)')
   AND NOT EXISTS (SELECT 1 FROM permission_set_items i WHERE i.permission_set_id = ps.id AND i.permission_id = p.id);
