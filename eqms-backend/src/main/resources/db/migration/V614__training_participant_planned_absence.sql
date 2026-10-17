-- A person who is known to be away before the training (leave, maternity leave...) stays in the attendee list; the reason is written on the row.
ALTER TABLE training_participants ADD COLUMN IF NOT EXISTS planned_absence TEXT;
