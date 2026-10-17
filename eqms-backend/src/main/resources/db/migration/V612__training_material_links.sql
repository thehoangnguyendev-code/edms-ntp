-- A training material can also be a link (for example a video or a web page). A link has no stored file, size or fingerprint; the screen marks it as outside the controlled content.
ALTER TABLE training_materials ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE training_materials ALTER COLUMN original_name DROP NOT NULL;
ALTER TABLE training_materials ALTER COLUMN provider DROP NOT NULL;
ALTER TABLE training_materials ALTER COLUMN stored_path DROP NOT NULL;
ALTER TABLE training_materials ALTER COLUMN content_type DROP NOT NULL;
ALTER TABLE training_materials ALTER COLUMN size_bytes DROP NOT NULL;
ALTER TABLE training_materials ALTER COLUMN sha256 DROP NOT NULL;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_training_materials_file_or_link') THEN
        ALTER TABLE training_materials ADD CONSTRAINT ck_training_materials_file_or_link CHECK (
            (link_url IS NOT NULL AND stored_path IS NULL AND purpose = 'CONTENT')
            OR (link_url IS NULL AND stored_path IS NOT NULL AND sha256 IS NOT NULL AND original_name IS NOT NULL));
    END IF;
END $$;
