-- Add seconds to the default timestamp presentation for future signatures.
-- Existing per-signature snapshots remain immutable and are intentionally not changed.
ALTER TABLE electronic_signature_settings
    ALTER COLUMN signature_timestamp_format SET DEFAULT 'dd-MMM-uuuu HH:mm:ss';

UPDATE electronic_signature_settings
SET signature_timestamp_format = 'dd-MMM-uuuu HH:mm:ss',
    timestamp_format_effective_from = now()
WHERE signature_timestamp_format = 'dd-MMM-uuuu HH:mm';
