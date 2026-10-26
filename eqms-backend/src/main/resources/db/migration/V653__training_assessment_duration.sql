-- The duration of a test, written in the form APD.0009 as "Test duration" (minutes). Optional: without it the field stays as dots for the trainer to write.
ALTER TABLE training_assessment_defs ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE training_assessment_defs DROP CONSTRAINT IF EXISTS ck_training_assessment_duration;
ALTER TABLE training_assessment_defs ADD CONSTRAINT ck_training_assessment_duration CHECK (duration_minutes IS NULL OR (duration_minutes BETWEEN 1 AND 480));
