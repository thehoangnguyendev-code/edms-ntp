-- A scan can say which numbered paper copy (pack) it is the scan of, so that each copy that came back can be matched with its scan.
ALTER TABLE training_paper_evidence ADD COLUMN IF NOT EXISTS pack_id UUID REFERENCES training_paper_packs(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ix_training_paper_evidence_pack ON training_paper_evidence (pack_id) WHERE pack_id IS NOT NULL;
