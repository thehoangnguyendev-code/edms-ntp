ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS training_period_days INTEGER,
    ADD COLUMN IF NOT EXISTS reason_for_skipping_training VARCHAR(1024);

ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS training_period_days INTEGER,
    ADD COLUMN IF NOT EXISTS reason_for_skipping_training VARCHAR(1024);

UPDATE documents
SET training_period_days = COALESCE(training_period_days, 7);

UPDATE document_revisions dr
SET training_period_days = COALESCE(dr.training_period_days, d.training_period_days, 7),
    reason_for_skipping_training = COALESCE(dr.reason_for_skipping_training, d.reason_for_skipping_training)
FROM documents d
WHERE dr.document_id = d.id;
