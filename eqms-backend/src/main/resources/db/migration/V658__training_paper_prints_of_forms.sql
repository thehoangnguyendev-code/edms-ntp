-- Paper prints of the forms that are signed by hand: the self-reading list (APD.0108) of a session is a numbered copy like the attendance sheet (a new kind of pack), and the job assignment
-- (APD.0024) has a log of its prints. A reprint needs a reason; neither can be changed or deleted.
ALTER TABLE training_paper_packs DROP CONSTRAINT IF EXISTS ck_training_paper_pack_kind;
ALTER TABLE training_paper_packs ADD CONSTRAINT ck_training_paper_pack_kind CHECK (pack_kind IN ('ATTENDANCE', 'EXAM', 'SELFREAD'));

CREATE TABLE IF NOT EXISTS training_job_prints (
    id            UUID PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES training_job_assignments(id) ON DELETE RESTRICT,
    copy_no       INTEGER NOT NULL CHECK (copy_no >= 1),
    print_code    VARCHAR(80) NOT NULL UNIQUE,
    sha256        VARCHAR(64) NOT NULL,
    reason        TEXT,
    printed_by    UUID NOT NULL REFERENCES app_users(id),
    printed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (assignment_id, copy_no),
    CONSTRAINT ck_training_job_print_reason CHECK (copy_no = 1 OR (reason IS NOT NULL AND length(btrim(reason)) > 0))
);
CREATE OR REPLACE FUNCTION training_job_print_guard() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'A printed job assignment is a record and cannot be changed or deleted' USING ERRCODE = '0LPTR';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_job_print_guard ON training_job_prints;
CREATE TRIGGER trg_training_job_print_guard BEFORE UPDATE OR DELETE ON training_job_prints FOR EACH ROW EXECUTE FUNCTION training_job_print_guard();
