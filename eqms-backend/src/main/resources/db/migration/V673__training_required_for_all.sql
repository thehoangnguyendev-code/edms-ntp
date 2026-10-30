-- SOP.0003 5.3.1: the training matrix has a group "General education as factory's requirement" whose positions are "All employees". Decision of the owner (2026-10-26): Quality Assurance
-- (Training Administration) keeps the list of these trainings; the head of a department cannot take one out of the matrix of the department.
--   training_topics.required_for_all        the topic is required of every employee of the factory (only a topic of the scope FACTORY_GENERAL)
--   training_topics.required_for_all_annual it is repeated every year
--   training_matrix_rows.all_employees      the row of a matrix version that comes from such a topic: it cannot be taken out and is ticked for every Job Role of the department
ALTER TABLE training_topics ADD COLUMN IF NOT EXISTS required_for_all BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE training_topics ADD COLUMN IF NOT EXISTS required_for_all_annual BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE training_topics DROP CONSTRAINT IF EXISTS ck_training_topics_required_for_all;
ALTER TABLE training_topics ADD CONSTRAINT ck_training_topics_required_for_all CHECK (NOT required_for_all OR scope = 'FACTORY_GENERAL');
ALTER TABLE training_matrix_rows ADD COLUMN IF NOT EXISTS all_employees BOOLEAN NOT NULL DEFAULT FALSE;
