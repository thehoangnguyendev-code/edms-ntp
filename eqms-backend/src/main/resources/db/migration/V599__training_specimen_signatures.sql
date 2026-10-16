-- Training Management, specimen signatures (SOP.0003 section 5.3.9, SDS-TR-001 section 4.5): the image of the signature of a person, confirmed by a person
-- designated for the step, one approved image per person. The image is kept in the records bucket (never deleted); the row is never changed except to
-- replace an approved image by a newer one. Forward-only and idempotent.

CREATE TABLE IF NOT EXISTS training_specimen_signatures (
    id                  UUID PRIMARY KEY,
    person_user_id      UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    version_no          INTEGER NOT NULL,
    status              VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','SUPERSEDED','REJECTED')),
    effective_date      DATE,
    provider            VARCHAR(20) NOT NULL,
    stored_path         TEXT NOT NULL,
    object_key          TEXT,
    content_type        VARCHAR(40) NOT NULL,
    size_bytes          INTEGER NOT NULL,
    sha256              VARCHAR(64) NOT NULL,
    uploaded_by         UUID NOT NULL REFERENCES app_users(id),
    confirmed_by        UUID REFERENCES app_users(id),
    confirmed_signature_id UUID,
    change_reason       TEXT,
    reject_reason       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (person_user_id, version_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_specimen_approved ON training_specimen_signatures (person_user_id) WHERE status = 'APPROVED';
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_specimen_pending ON training_specimen_signatures (person_user_id) WHERE status = 'PENDING';

CREATE OR REPLACE FUNCTION training_specimen_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A specimen signature cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status IN ('SUPERSEDED','REJECTED') THEN RAISE EXCEPTION 'A closed specimen signature cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'APPROVED' AND NEW.status <> 'SUPERSEDED' THEN RAISE EXCEPTION 'An approved specimen signature cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.sha256 <> OLD.sha256 OR NEW.stored_path <> OLD.stored_path THEN RAISE EXCEPTION 'The image of a specimen signature cannot be replaced' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_specimen_guard ON training_specimen_signatures;
CREATE TRIGGER trg_training_specimen_guard BEFORE UPDATE OR DELETE ON training_specimen_signatures FOR EACH ROW EXECUTE FUNCTION training_specimen_guard();
