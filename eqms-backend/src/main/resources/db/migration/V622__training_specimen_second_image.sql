-- Training Management, specimen signatures (FRM.0007, TR-48, decision of the owner 2026-10-18): the form asks for two specimen signatures, "1st" and "2nd". A new version holds both
-- images and the second one is required; a version made before this change holds the first one only. Like the first image, the second cannot be replaced.
-- Forward-only and idempotent.

ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS provider_2     VARCHAR(20);
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS stored_path_2  TEXT;
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS object_key_2   TEXT;
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS content_type_2  VARCHAR(40);
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS size_bytes_2   INTEGER;
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS sha256_2       VARCHAR(64);

CREATE OR REPLACE FUNCTION training_specimen_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A specimen signature cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status IN ('SUPERSEDED','REJECTED') THEN RAISE EXCEPTION 'A closed specimen signature cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'APPROVED' AND NEW.status <> 'SUPERSEDED' THEN RAISE EXCEPTION 'An approved specimen signature cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.sha256 <> OLD.sha256 OR NEW.stored_path <> OLD.stored_path THEN RAISE EXCEPTION 'The image of a specimen signature cannot be replaced' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.sha256_2 IS DISTINCT FROM OLD.sha256_2 OR NEW.stored_path_2 IS DISTINCT FROM OLD.stored_path_2 THEN RAISE EXCEPTION 'The second image of a specimen signature cannot be replaced' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
