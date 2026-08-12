ALTER TABLE documents ADD COLUMN IF NOT EXISTS periodic_review_cycle INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS periodic_review_notification INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sub_type VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS language VARCHAR(100);

ALTER TABLE document_revisions ADD COLUMN IF NOT EXISTS periodic_review_cycle INTEGER;
ALTER TABLE document_revisions ADD COLUMN IF NOT EXISTS periodic_review_notification INTEGER;
ALTER TABLE document_revisions ADD COLUMN IF NOT EXISTS sub_type VARCHAR(255);
ALTER TABLE document_revisions ADD COLUMN IF NOT EXISTS language VARCHAR(100);
