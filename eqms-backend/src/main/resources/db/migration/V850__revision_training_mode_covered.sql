-- A revision of a related document that needs no training of its own and is published with the document whose training covered it carries training_mode COVERED
-- (the Training Number and the days of that training are its evidence). DEC-TRAINING-2026-11-24-8.
ALTER TABLE document_revisions DROP CONSTRAINT IF EXISTS ck_revision_training_mode;
ALTER TABLE document_revisions ADD CONSTRAINT ck_revision_training_mode CHECK (training_mode IS NULL OR training_mode IN ('INTEGRATED', 'MANUAL', 'COVERED'));
