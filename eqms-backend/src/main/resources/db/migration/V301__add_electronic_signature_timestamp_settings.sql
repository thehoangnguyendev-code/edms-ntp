ALTER TABLE electronic_signature_settings
    ADD COLUMN IF NOT EXISTS signature_timestamp_format VARCHAR(40),
    ADD COLUMN IF NOT EXISTS signature_timezone VARCHAR(64);
