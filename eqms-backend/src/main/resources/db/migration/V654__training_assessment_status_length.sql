-- "PENDING_APPROVAL" (16 characters) did not fit the column of the status (12): found when a draft was submitted on DEV.
ALTER TABLE training_assessment_defs ALTER COLUMN status TYPE VARCHAR(20);
