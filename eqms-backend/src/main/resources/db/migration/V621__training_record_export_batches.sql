-- Training Management, batch export of personal training records (SOP.0003 5.3.10, TR-44, proposal D-48): QA prints the personal records of a department each year.
-- One batch is prepared by one person with a signature and approved by a different person designated, with a signature. Only then is a ZIP written, one PDF
-- (APD.0014) for each person of the department who has records up to the end of the year chosen. The ZIP is kept unchanged with its SHA-256.
-- Forward-only and idempotent. Nothing is granted to any role here.

CREATE TABLE IF NOT EXISTS training_record_export_batches (
    id                     UUID PRIMARY KEY,
    department_id          UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    year                   INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    status                 VARCHAR(20) NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL','APPROVED','REJECTED')),
    reason                 TEXT NOT NULL,
    person_count           INTEGER NOT NULL CHECK (person_count >= 1),
    prepared_by            UUID NOT NULL REFERENCES app_users(id),
    prepared_signature_id  UUID,
    approved_by            UUID REFERENCES app_users(id),
    approved_signature_id  UUID,
    reject_reason          TEXT,
    provider               VARCHAR(20),
    stored_path            TEXT,
    sha256                 VARCHAR(64),
    size_bytes             BIGINT,
    generated_at           TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_training_export_batch_apart CHECK (approved_by IS NULL OR approved_by <> prepared_by)
);
CREATE INDEX IF NOT EXISTS ix_training_export_batches_department ON training_record_export_batches (department_id, year DESC, created_at DESC);

CREATE OR REPLACE FUNCTION training_record_export_batch_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A batch export cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'A closed batch export cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_record_export_batch_guard ON training_record_export_batches;
CREATE TRIGGER trg_training_record_export_batch_guard BEFORE UPDATE OR DELETE ON training_record_export_batches FOR EACH ROW EXECUTE FUNCTION training_record_export_batch_guard();
