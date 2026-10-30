-- The initial training is not fixed at three parts (owner decision 2026-10-27): the staff who manage Training can add other parts (other trainings a new employee goes through) and remove
-- them. The part "job-specific training" (it comes from the matrix of the Job Roles) stays, one only. The trainings of a part can be any active training, one part each.
ALTER TABLE training_initial_parts DROP CONSTRAINT IF EXISTS training_initial_parts_part_no_check;
ALTER TABLE training_initial_parts ADD CONSTRAINT training_initial_parts_part_no_check CHECK (part_no >= 1);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_initial_matrix_part ON training_initial_parts (from_matrix) WHERE from_matrix;
