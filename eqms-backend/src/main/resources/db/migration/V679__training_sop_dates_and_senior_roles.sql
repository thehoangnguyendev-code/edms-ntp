-- Check of SOP.0003 against the software (owner request 2026-10-27):
-- 1. 5.3.7: the results go to QA "within 7 working days". The number of days stays a setting of Training Properties; how the days are counted is now a setting too.
ALTER TABLE training_settings ADD COLUMN IF NOT EXISTS results_due_day_type VARCHAR(20) NOT NULL DEFAULT 'WORKING_MON_FRI';
ALTER TABLE training_settings DROP CONSTRAINT IF EXISTS ck_training_settings_day_type;
ALTER TABLE training_settings ADD CONSTRAINT ck_training_settings_day_type CHECK (results_due_day_type IN ('WORKING_MON_FRI', 'WORKING_MON_SAT', 'CALENDAR'));
-- 2. 5.3.2: the training requirement for the SOPs after the periodic review is prepared and approved at the latest on the last day of the month in which the review was completed.
ALTER TABLE training_requirements ADD COLUMN IF NOT EXISTS review_completed_on DATE;
-- 3. 5.3.1: the matrix of the senior management positions (quality management, production management) is built by QA.
ALTER TABLE training_job_roles ADD COLUMN IF NOT EXISTS senior_management BOOLEAN NOT NULL DEFAULT FALSE;
