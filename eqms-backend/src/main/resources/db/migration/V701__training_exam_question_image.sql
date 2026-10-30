-- A question of the test taken in the system may carry a picture (owner request 2026-10-29), as the questions of the assessment library do (V700): a data URL (PNG or JPEG, up to 1.5 MB)
-- shown under the text of the question to the trainee and to the people who read the test. Forward-only and idempotent.
ALTER TABLE training_exam_questions ADD COLUMN IF NOT EXISTS image TEXT;
