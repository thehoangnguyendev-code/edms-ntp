-- Training Management, paper first (SOP.0003 5.3.7, TR-52, APD.0009): a test taken on paper carries the Training Number and the trainee signature in the footer of every page. The
-- system prints a copy of the approved exam (a PDF) for each trainee with that footer and a cover page; the approved file itself is never changed. Each print is a controlled print
-- like the attendance pack: numbered, recorded, and a reprint needs a reason. Forward-only and idempotent.

ALTER TABLE training_paper_packs ADD COLUMN IF NOT EXISTS pack_kind VARCHAR(12) NOT NULL DEFAULT 'ATTENDANCE';
ALTER TABLE training_paper_packs DROP CONSTRAINT IF EXISTS ck_training_paper_pack_kind;
ALTER TABLE training_paper_packs ADD CONSTRAINT ck_training_paper_pack_kind CHECK (pack_kind IN ('ATTENDANCE','EXAM'));
ALTER TABLE training_paper_packs DROP CONSTRAINT IF EXISTS ux_training_paper_pack_copy;
ALTER TABLE training_paper_packs ADD CONSTRAINT ux_training_paper_pack_copy UNIQUE (session_id, pack_kind, copy_no);
