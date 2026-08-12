ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS training_planned_date DATE,
    ADD COLUMN IF NOT EXISTS training_period_end_date DATE;
