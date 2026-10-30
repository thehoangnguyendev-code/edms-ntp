-- Simplify the initial training (owner decision 2026-10-27, SOP.0003 5.1 and 5.3.1): there is no "package" of initial training. What a new employee must learn is in the training matrix, in the
-- three groups of the SOP (factory-wide, department-wide, procedures of the position); the first two are the column "All employees" (rows with all_employees: every active employee of the
-- department, with or without a Job Role), the third is the column of each Job Role. The training is given by a Training Activity of the kind Initial (QA gives the training number).
-- 1. the configuration of the "parts" is not needed any more
DROP TABLE IF EXISTS training_initial_part_topics;
DROP TABLE IF EXISTS training_initial_parts;
-- 2. the unit that gives a training (HR, QA, the related department) is a property of the topic, taken from the Departments
ALTER TABLE training_topics ADD COLUMN IF NOT EXISTS unit_department_id UUID REFERENCES departments(id);
-- training_settings.initial_training_days stays: the number of days an employee is "new" (the mark in Training Compliance)
COMMENT ON COLUMN training_settings.initial_training_days IS 'An employee who started in the last this many days is marked as a new employee in Training Compliance';
