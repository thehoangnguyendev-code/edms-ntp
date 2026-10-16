-- Training Management, export of the personal training record as a PDF (APD.0014, SDS-TR-001 section 4.5): prepared by one person with a signature, approved by
-- a person designated with a signature, then generated once and kept unchanged with its SHA-256. Forward-only and idempotent.

CREATE TABLE IF NOT EXISTS training_record_exports (
    id                     UUID PRIMARY KEY,
    person_user_id         UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    status                 VARCHAR(20) NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL','APPROVED','REJECTED')),
    reason                 TEXT NOT NULL,
    prepared_by            UUID NOT NULL REFERENCES app_users(id),
    prepared_signature_id  UUID,
    approved_by            UUID REFERENCES app_users(id),
    approved_signature_id  UUID,
    reject_reason          TEXT,
    provider               VARCHAR(20),
    stored_path            TEXT,
    sha256                 VARCHAR(64),
    size_bytes             INTEGER,
    record_count           INTEGER,
    generated_at           TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_training_record_exports_person ON training_record_exports (person_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION training_record_export_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A training record export cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'A closed training record export cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_record_export_guard ON training_record_exports;
CREATE TRIGGER trg_training_record_export_guard BEFORE UPDATE OR DELETE ON training_record_exports FOR EACH ROW EXECUTE FUNCTION training_record_export_guard();
