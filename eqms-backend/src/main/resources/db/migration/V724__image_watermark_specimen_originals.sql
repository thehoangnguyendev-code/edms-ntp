-- Image watermark (Settings > Configuration > Image Watermark; owner decision 2026-11-01): a specimen signature picture can carry a stamp of the logo, the uploader and the time of the upload.
-- The columns that were there (provider, stored_path, ..., sha256 and the _2 ones) keep the picture that the screens show, which is the stamped copy when a stamp was applied.
-- The picture as it was uploaded is kept beside it in the original_* columns, so the person who compares the strokes (a reconciler, an auditor) can open it. When no stamp was applied
-- the original_* columns stay empty and the picture shown is the original. Rows written before this change are not stamped (watermarked = false).
-- Forward-only and idempotent.

ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS watermarked             BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS original_provider      VARCHAR(20);
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS original_stored_path   TEXT;
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS original_object_key    TEXT;
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS original_content_type  VARCHAR(40);
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS original_size_bytes    INTEGER;
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS original_sha256        VARCHAR(64);
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS original_provider_2    VARCHAR(20);
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS original_stored_path_2 TEXT;
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS original_object_key_2  TEXT;
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS original_content_type_2 VARCHAR(40);
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS original_size_bytes_2  INTEGER;
ALTER TABLE training_specimen_signatures ADD COLUMN IF NOT EXISTS original_sha256_2      VARCHAR(64);

-- The guard of V667 with one more rule: the original of a picture cannot be replaced either, while the images may still be uploaded again on a rejected row.
CREATE OR REPLACE FUNCTION training_specimen_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A specimen signature cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'OBSOLETED' THEN RAISE EXCEPTION 'An obsoleted specimen signature cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'APPROVED' AND NEW.status <> 'OBSOLETED' THEN RAISE EXCEPTION 'An approved specimen signature cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'PENDING_CONFIRMATION' AND OLD.reject_reason IS NOT NULL AND NEW.status = 'PENDING_CONFIRMATION' THEN RETURN NEW; END IF;
    IF NEW.sha256 <> OLD.sha256 OR NEW.stored_path <> OLD.stored_path THEN RAISE EXCEPTION 'The image of a specimen signature cannot be replaced' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.sha256_2 IS DISTINCT FROM OLD.sha256_2 OR NEW.stored_path_2 IS DISTINCT FROM OLD.stored_path_2 THEN RAISE EXCEPTION 'The second image of a specimen signature cannot be replaced' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.original_sha256 IS DISTINCT FROM OLD.original_sha256 OR NEW.original_sha256_2 IS DISTINCT FROM OLD.original_sha256_2
       OR NEW.original_stored_path IS DISTINCT FROM OLD.original_stored_path OR NEW.original_stored_path_2 IS DISTINCT FROM OLD.original_stored_path_2 THEN
        RAISE EXCEPTION 'The original image of a specimen signature cannot be replaced' USING ERRCODE = '0LPTR';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
