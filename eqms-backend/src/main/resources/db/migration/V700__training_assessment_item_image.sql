-- A question of a test (not of a checklist) may carry a picture (owner request 2026-10-29): kept with the question as a data URL (PNG or JPEG, up to 1.5 MB), drawn under the text of the question
-- in the form APD.0009. A new version of an assessment copies it. Forward-only and idempotent.
ALTER TABLE training_assessment_def_items ADD COLUMN IF NOT EXISTS image TEXT;
