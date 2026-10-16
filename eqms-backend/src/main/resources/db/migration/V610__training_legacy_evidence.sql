-- Training Management, evidence of the training of documents imported from paper (SDS-TR-001 decision D-27): for each imported revision that required training, the scan of
-- the paper training record is attached and a person designated by the submitter verifies it with a signature, or the revision is declared "not evidenced" with a reason and
-- that is verified the same way. Once verified the row never changes. Forward-only and idempotent.

CREATE TABLE IF NOT EXISTS training_legacy_evidence (
    id                    UUID PRIMARY KEY,
    revision_id           UUID NOT NULL REFERENCES document_revisions(id) ON DELETE RESTRICT,
    document_number       VARCHAR(80),
    revision_number       VARCHAR(40),
    document_name         VARCHAR(255),
    completion_date       DATE,
    paper_training_number VARCHAR(40),
    not_evidenced         BOOLEAN NOT NULL DEFAULT FALSE,
    not_evidenced_reason  TEXT,
    original_name         VARCHAR(255),
    provider              VARCHAR(20),
    stored_path           TEXT,
    content_type          VARCHAR(100),
    size_bytes            INTEGER,
    sha256                VARCHAR(64),
    status                VARCHAR(10) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','VERIFIED','REJECTED')),
    submitted_by          UUID NOT NULL REFERENCES app_users(id),
    submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_by           UUID REFERENCES app_users(id),
    verified_at           TIMESTAMPTZ,
    signature_id          UUID,
    reject_reason         TEXT,
    CHECK ((not_evidenced AND not_evidenced_reason IS NOT NULL AND stored_path IS NULL) OR (NOT not_evidenced AND stored_path IS NOT NULL AND sha256 IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_legacy_evidence_open ON training_legacy_evidence (revision_id) WHERE status IN ('SUBMITTED','VERIFIED');

CREATE OR REPLACE FUNCTION training_legacy_evidence_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Legacy training evidence cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'Verified or rejected legacy training evidence cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.stored_path IS DISTINCT FROM OLD.stored_path OR NEW.revision_id <> OLD.revision_id OR NEW.submitted_by <> OLD.submitted_by THEN
        RAISE EXCEPTION 'The file of legacy training evidence cannot be replaced' USING ERRCODE = '0LPTR';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_legacy_evidence_guard ON training_legacy_evidence;
CREATE TRIGGER trg_training_legacy_evidence_guard BEFORE UPDATE OR DELETE ON training_legacy_evidence FOR EACH ROW EXECUTE FUNCTION training_legacy_evidence_guard();

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), 'TRAINING_LEGACY_VERIFIED', 'Legacy Training Evidence Verified'
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings WHERE code = 'TRAINING_LEGACY_VERIFIED');
