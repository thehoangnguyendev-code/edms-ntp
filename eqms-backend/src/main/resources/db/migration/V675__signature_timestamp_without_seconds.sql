-- The time of an electronic signature is written to the minute: dd/MM/yyyy HH:mm (zone of the site). The signature record keeps the exact moment (signed_at, to the second);
-- only the way it is written changes. The text stored with a signature already made (electronic_signatures.timestamp_display) is the record as it was signed and is NOT changed here.
ALTER TABLE electronic_signature_settings DROP CONSTRAINT IF EXISTS ck_signature_timestamp_format;
ALTER TABLE electronic_signature_settings ALTER COLUMN signature_timestamp_format SET DEFAULT 'dd/MM/uuuu HH:mm';
UPDATE electronic_signature_settings
   SET signature_timestamp_format = 'dd/MM/uuuu HH:mm', timestamp_format_effective_from = now()
 WHERE signature_timestamp_format IS DISTINCT FROM 'dd/MM/uuuu HH:mm';
ALTER TABLE electronic_signature_settings ADD CONSTRAINT ck_signature_timestamp_format CHECK (signature_timestamp_format = 'dd/MM/uuuu HH:mm');
