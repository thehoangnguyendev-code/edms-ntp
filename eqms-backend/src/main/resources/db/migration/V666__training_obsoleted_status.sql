-- Training Management: one name for a version that was replaced by a newer one: OBSOLETED (owner decision 2026-10-26).
--   training_assessment_defs  SUPERSEDED -> OBSOLETED
--   training_job_assignments  SUPERSEDED -> OBSOLETED
--   training_matrix_versions  OBSOLETE   -> OBSOLETED
-- The guard triggers close these rows, so they are dropped first and recreated at the end.
DROP TRIGGER IF EXISTS trg_training_job_assignment_guard ON training_job_assignments;
DROP TRIGGER IF EXISTS trg_training_matrix_version_guard ON training_matrix_versions;

ALTER TABLE training_job_assignments DROP CONSTRAINT IF EXISTS training_job_assignments_status_check;
ALTER TABLE training_matrix_versions DROP CONSTRAINT IF EXISTS training_matrix_versions_status_check;
ALTER TABLE training_assessment_defs DROP CONSTRAINT IF EXISTS ck_training_assessment_status;

UPDATE training_job_assignments SET status = 'OBSOLETED' WHERE status = 'SUPERSEDED';
UPDATE training_matrix_versions SET status = 'OBSOLETED' WHERE status = 'OBSOLETE';
UPDATE training_assessment_defs SET status = 'OBSOLETED' WHERE status = 'SUPERSEDED';

ALTER TABLE training_job_assignments ADD CONSTRAINT training_job_assignments_status_check CHECK (status IN ('DRAFT','PENDING_RECEIVER','EFFECTIVE','OBSOLETED','CANCELLED'));
ALTER TABLE training_matrix_versions ADD CONSTRAINT training_matrix_versions_status_check CHECK (status IN ('DRAFT','PENDING_APPROVAL','EFFECTIVE','OBSOLETED'));
ALTER TABLE training_assessment_defs ADD CONSTRAINT ck_training_assessment_status CHECK (status IN ('DRAFT','PENDING_APPROVAL','EFFECTIVE','OBSOLETED'));

CREATE OR REPLACE FUNCTION training_job_assignment_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('PENDING_RECEIVER','EFFECTIVE','OBSOLETED') THEN RAISE EXCEPTION 'A signed job assignment cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
        RETURN OLD;
    END IF;
    IF OLD.status = 'OBSOLETED' THEN RAISE EXCEPTION 'An obsoleted job assignment cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'EFFECTIVE' AND NEW.status <> 'OBSOLETED' THEN RAISE EXCEPTION 'An effective job assignment cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_training_job_assignment_guard BEFORE UPDATE OR DELETE ON training_job_assignments FOR EACH ROW EXECUTE FUNCTION training_job_assignment_guard();

CREATE OR REPLACE FUNCTION training_job_duty_guard() RETURNS trigger AS $$
DECLARE s VARCHAR(20);
BEGIN
    SELECT status INTO s FROM training_job_assignments WHERE id = COALESCE(OLD.assignment_id, NEW.assignment_id);
    IF s IN ('PENDING_RECEIVER','EFFECTIVE','OBSOLETED') THEN RAISE EXCEPTION 'The duties of a signed job assignment cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION training_matrix_version_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('EFFECTIVE','OBSOLETED') THEN RAISE EXCEPTION 'A matrix version that was approved cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
        RETURN OLD;
    END IF;
    IF OLD.status = 'OBSOLETED' THEN RAISE EXCEPTION 'An obsoleted matrix version cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'EFFECTIVE' AND NEW.status <> 'OBSOLETED' THEN RAISE EXCEPTION 'An effective matrix version cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_training_matrix_version_guard BEFORE UPDATE OR DELETE ON training_matrix_versions FOR EACH ROW EXECUTE FUNCTION training_matrix_version_guard();

CREATE OR REPLACE FUNCTION training_matrix_content_guard() RETURNS trigger AS $$
DECLARE v UUID; s VARCHAR(20);
BEGIN
    IF TG_TABLE_NAME = 'training_matrix_rows' THEN
        v := COALESCE(OLD.version_id, NEW.version_id);
    ELSE
        SELECT r.version_id INTO v FROM training_matrix_rows r WHERE r.id = COALESCE(OLD.row_id, NEW.row_id);
    END IF;
    SELECT status INTO s FROM training_matrix_versions WHERE id = v;
    IF s IN ('EFFECTIVE','OBSOLETED','PENDING_APPROVAL') THEN RAISE EXCEPTION 'The content of an approved or submitted matrix version cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
