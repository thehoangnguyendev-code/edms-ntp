-- V627: Training trainer qualification (SOP.0003 TR-19, D-10). The condition "heads the department that organises the training" was organisational.
-- It is replaced by a permission that QA grants: a trainer holding training.trainer.qualified counts as trained on every topic of the session (the GMP
-- training record is still required). Nothing is granted here; QA assigns the set in Security & Authorization. Idempotent.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'training.trainer.qualified', 'Qualified Trainer on Any Topic', 'Training Management', 'training', 'training_activity',
       'Counts as qualified to train any topic, given a GMP training record. Granted by QA; replaces the head of the organising department rule.', 243, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = 'training.trainer.qualified');

INSERT INTO permission_sets (id, name, code, description, active, system)
SELECT gen_random_uuid(), 'Training - Qualified Trainer', 'TRAINING_TRAINER_QUALIFIED',
       'Qualified to train any topic (with a GMP training record). Assign only to people QA has qualified as trainers.', true, false
WHERE NOT EXISTS (SELECT 1 FROM permission_sets s WHERE s.code = 'TRAINING_TRAINER_QUALIFIED');

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps JOIN permissions p ON p.code = 'training.trainer.qualified'
WHERE ps.code = 'TRAINING_TRAINER_QUALIFIED'
  AND NOT EXISTS (SELECT 1 FROM permission_set_items x WHERE x.permission_set_id = ps.id AND x.permission_id = p.id);
