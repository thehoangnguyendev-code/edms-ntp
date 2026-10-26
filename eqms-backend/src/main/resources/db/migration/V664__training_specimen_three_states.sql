-- The states of a specimen signature (FRM.0007, SOP.0003 5.3.9) are three: Pending Confirmation (written, the head of the unit has not confirmed it), Approved (the one in force: the only one that is used) and
-- Obsoleted (no longer in force: replaced by a newer approved one, or not confirmed). Before this there were four: Pending, Approved, Superseded and Rejected. A signature that was rejected is Obsoleted and keeps
-- its reject reason, so what happened to it can still be told; one that was replaced keeps the day it came in force.
-- The guard is dropped first: it forbids to change a closed row, and the rows are moved here.
DROP TRIGGER IF EXISTS trg_training_specimen_guard ON training_specimen_signatures;
ALTER TABLE training_specimen_signatures DROP CONSTRAINT IF EXISTS training_specimen_signatures_status_check;
DROP INDEX IF EXISTS ux_training_specimen_pending;
ALTER TABLE training_specimen_signatures ALTER COLUMN status TYPE VARCHAR(20);
UPDATE training_specimen_signatures SET status = 'OBSOLETED' WHERE status IN ('SUPERSEDED', 'REJECTED');
UPDATE training_specimen_signatures SET status = 'PENDING_CONFIRMATION' WHERE status = 'PENDING';
ALTER TABLE training_specimen_signatures ADD CONSTRAINT training_specimen_signatures_status_check CHECK (status IN ('PENDING_CONFIRMATION', 'APPROVED', 'OBSOLETED'));
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_specimen_pending ON training_specimen_signatures (person_user_id) WHERE status = 'PENDING_CONFIRMATION';

CREATE OR REPLACE FUNCTION training_specimen_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A specimen signature cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'OBSOLETED' THEN RAISE EXCEPTION 'An obsoleted specimen signature cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'APPROVED' AND NEW.status <> 'OBSOLETED' THEN RAISE EXCEPTION 'An approved specimen signature cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.sha256 <> OLD.sha256 OR NEW.stored_path <> OLD.stored_path THEN RAISE EXCEPTION 'The image of a specimen signature cannot be replaced' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.sha256_2 IS DISTINCT FROM OLD.sha256_2 OR NEW.stored_path_2 IS DISTINCT FROM OLD.stored_path_2 THEN RAISE EXCEPTION 'The second image of a specimen signature cannot be replaced' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_training_specimen_guard BEFORE UPDATE OR DELETE ON training_specimen_signatures FOR EACH ROW EXECUTE FUNCTION training_specimen_guard();
