ALTER TABLE electronic_signature_settings
    ADD COLUMN IF NOT EXISTS display_font_size_pt NUMERIC(4,1) NOT NULL DEFAULT 8.5;

UPDATE electronic_signature_settings
SET display_font_size_pt = 8.5
WHERE display_font_size_pt IS NULL;
