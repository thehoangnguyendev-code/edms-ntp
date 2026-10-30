-- Training Management: the trainer is written in the content of the training (APD.0117) and is not on the list of the people who take part (owner decision 2026-10-28),
-- so "TRAINER" is no longer a way of taking part. The trainer's own training record (result TRAINER) is written when QA confirms the completion.
-- No row has it on DEV (V695 was deployed on the same day); the update keeps a row that might exist as an attendee who takes no assessment.
UPDATE training_participants SET participation_role = 'ATTENDEE' WHERE participation_role = 'TRAINER';
ALTER TABLE training_participants DROP CONSTRAINT IF EXISTS ck_training_participants_role;
ALTER TABLE training_participants ADD CONSTRAINT ck_training_participants_role CHECK (participation_role IN ('TRAINEE', 'ATTENDEE', 'NAME_ONLY'));
