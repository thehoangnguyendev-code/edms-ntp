-- Training Management, the files of an activity (SDS-TR-001 section 4.4): the training content and test, and the scans of attendance sheets and tests that were signed on paper
-- (D-20). A file is stored in the records bucket with its SHA-256 and is never changed; a material can be marked as removed (with a reason) only before its content is
-- reviewed, and the file stays on record. A scan is received by a second person who checks it against the paper. Forward-only and idempotent.

CREATE TABLE IF NOT EXISTS training_materials (
    id             UUID PRIMARY KEY,
    activity_id    UUID NOT NULL REFERENCES training_activities(id) ON DELETE RESTRICT,
    title          VARCHAR(255) NOT NULL,
    original_name  VARCHAR(255) NOT NULL,
    provider       VARCHAR(20) NOT NULL,
    stored_path    TEXT NOT NULL,
    content_type   VARCHAR(100) NOT NULL,
    size_bytes     INTEGER NOT NULL,
    sha256         VARCHAR(64) NOT NULL,
    uploaded_by    UUID NOT NULL REFERENCES app_users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_at     TIMESTAMPTZ,
    removed_by     UUID REFERENCES app_users(id),
    remove_reason  TEXT
);
CREATE INDEX IF NOT EXISTS ix_training_materials_activity ON training_materials (activity_id);

CREATE TABLE IF NOT EXISTS training_paper_evidence (
    id             UUID PRIMARY KEY,
    activity_id    UUID NOT NULL REFERENCES training_activities(id) ON DELETE RESTRICT,
    participant_id UUID REFERENCES training_participants(id),
    kind           VARCHAR(20) NOT NULL CHECK (kind IN ('ATTENDANCE_SHEET','ASSESSMENT','OTHER')),
    original_name  VARCHAR(255) NOT NULL,
    provider       VARCHAR(20) NOT NULL,
    stored_path    TEXT NOT NULL,
    content_type   VARCHAR(100) NOT NULL,
    size_bytes     INTEGER NOT NULL,
    sha256         VARCHAR(64) NOT NULL,
    remark         TEXT,
    uploaded_by    UUID NOT NULL REFERENCES app_users(id),
    uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_by    UUID REFERENCES app_users(id),
    received_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_training_paper_evidence_activity ON training_paper_evidence (activity_id);

-- Files are never deleted and the file itself never changes. Only the "removed" columns of a material and the "received" columns of a scan are written later, once.
CREATE OR REPLACE FUNCTION training_material_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A training file cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.stored_path <> OLD.stored_path OR NEW.sha256 <> OLD.sha256 OR NEW.activity_id <> OLD.activity_id OR NEW.title <> OLD.title THEN RAISE EXCEPTION 'A training file cannot be replaced' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.removed_at IS NOT NULL THEN RAISE EXCEPTION 'A removed training file cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_material_guard ON training_materials;
CREATE TRIGGER trg_training_material_guard BEFORE UPDATE OR DELETE ON training_materials FOR EACH ROW EXECUTE FUNCTION training_material_guard();

CREATE OR REPLACE FUNCTION training_paper_evidence_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A paper evidence file cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.stored_path <> OLD.stored_path OR NEW.sha256 <> OLD.sha256 OR NEW.activity_id <> OLD.activity_id OR NEW.uploaded_by <> OLD.uploaded_by THEN RAISE EXCEPTION 'A paper evidence file cannot be replaced' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.received_at IS NOT NULL THEN RAISE EXCEPTION 'A received paper evidence file cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_paper_evidence_guard ON training_paper_evidence;
CREATE TRIGGER trg_training_paper_evidence_guard BEFORE UPDATE OR DELETE ON training_paper_evidence FOR EACH ROW EXECUTE FUNCTION training_paper_evidence_guard();
