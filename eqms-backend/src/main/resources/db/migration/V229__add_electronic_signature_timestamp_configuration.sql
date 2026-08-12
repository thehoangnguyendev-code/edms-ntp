-- Timestamp presentation is configurable for future electronic signatures only.
-- The per-signature snapshot preserves the exact display value used at signing.
ALTER TABLE electronic_signature_settings
    ADD COLUMN IF NOT EXISTS signature_timestamp_format VARCHAR(80) NOT NULL DEFAULT 'dd-MMM-uuuu HH:mm',
    ADD COLUMN IF NOT EXISTS signature_timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    ADD COLUMN IF NOT EXISTS timestamp_format_effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

ALTER TABLE electronic_signatures
    ADD COLUMN IF NOT EXISTS timestamp_display VARCHAR(120);

COMMENT ON COLUMN electronic_signature_settings.signature_timestamp_format IS
    'Approved timestamp pattern used only for electronic signatures created after the configuration becomes effective.';
COMMENT ON COLUMN electronic_signature_settings.signature_timezone IS
    'IANA timezone used only for electronic signatures created after the configuration becomes effective.';
COMMENT ON COLUMN electronic_signature_settings.timestamp_format_effective_from IS
    'The instant from which the active signature timestamp format applies.';
COMMENT ON COLUMN electronic_signatures.timestamp_display IS
    'Immutable signed timestamp display snapshot. Existing records remain null and use the legacy canonical format.';
