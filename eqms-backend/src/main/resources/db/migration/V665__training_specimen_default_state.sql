-- V664 renamed the states of a specimen signature; the default state of a new row was still the old name (Pending), which the new check refuses. A new specimen signature is Pending Confirmation.
ALTER TABLE training_specimen_signatures ALTER COLUMN status SET DEFAULT 'PENDING_CONFIRMATION';
