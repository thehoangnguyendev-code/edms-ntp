-- Specimen signature (FRM.0007): a rejected one goes back to PENDING_CONFIRMATION with its reject_reason, and the person uploads the two images again on the same row
-- (owner decision 2026-10-26). The images may be replaced only while the row is Pending Confirmation AND was rejected; once approved or obsoleted nothing changes.
CREATE OR REPLACE FUNCTION training_specimen_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A specimen signature cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'OBSOLETED' THEN RAISE EXCEPTION 'An obsoleted specimen signature cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'APPROVED' AND NEW.status <> 'OBSOLETED' THEN RAISE EXCEPTION 'An approved specimen signature cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'PENDING_CONFIRMATION' AND OLD.reject_reason IS NOT NULL AND NEW.status = 'PENDING_CONFIRMATION' THEN RETURN NEW; END IF;
    IF NEW.sha256 <> OLD.sha256 OR NEW.stored_path <> OLD.stored_path THEN RAISE EXCEPTION 'The image of a specimen signature cannot be replaced' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.sha256_2 IS DISTINCT FROM OLD.sha256_2 OR NEW.stored_path_2 IS DISTINCT FROM OLD.stored_path_2 THEN RAISE EXCEPTION 'The second image of a specimen signature cannot be replaced' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
