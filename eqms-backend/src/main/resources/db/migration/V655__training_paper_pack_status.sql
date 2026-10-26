-- The copies of the paper packs (attendance sheets and test copies) are issued, then come back (filed with the record) or are lost or voided. Hybrid operation of Training (clean rooms):
-- the paper is the original, so where each numbered copy is must be known. Existing copies are Issued: nobody has recorded their return.
ALTER TABLE training_paper_packs
    ADD COLUMN IF NOT EXISTS status        VARCHAR(10) NOT NULL DEFAULT 'ISSUED',
    ADD COLUMN IF NOT EXISTS status_by     UUID REFERENCES app_users(id),
    ADD COLUMN IF NOT EXISTS status_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status_reason TEXT;

ALTER TABLE training_paper_packs
    ADD CONSTRAINT ck_training_paper_pack_status CHECK (status IN ('ISSUED', 'RETURNED', 'LOST', 'VOIDED')),
    ADD CONSTRAINT ck_training_paper_pack_status_who CHECK (status = 'ISSUED' OR (status_by IS NOT NULL AND status_at IS NOT NULL)),
    ADD CONSTRAINT ck_training_paper_pack_status_reason CHECK (status IN ('ISSUED', 'RETURNED') OR (status_reason IS NOT NULL AND length(btrim(status_reason)) > 0));
