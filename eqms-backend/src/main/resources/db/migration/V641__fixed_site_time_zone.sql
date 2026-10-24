-- One time zone for every date and time of the system: the zone of the site, Asia/Ho_Chi_Minh. It is not a setting of the system, of a user or of the electronic signature.
-- Moments stay stored as absolute instants (timestamptz); only how they are shown and how a day is cut is fixed. The zone written on a signature already made
-- (electronic_signatures.timezone) is the record as it was signed and is NOT changed.
UPDATE system_configurations
   SET general_config = jsonb_set(general_config, '{timeZone}', '"Asia/Ho_Chi_Minh"'::jsonb, true)
 WHERE general_config->>'timeZone' IS DISTINCT FROM 'Asia/Ho_Chi_Minh';

UPDATE user_localization_preferences SET time_zone = 'Asia/Ho_Chi_Minh' WHERE time_zone IS DISTINCT FROM 'Asia/Ho_Chi_Minh';

UPDATE electronic_signature_settings
   SET signature_timezone = 'Asia/Ho_Chi_Minh', timestamp_format_effective_from = now()
 WHERE signature_timezone IS DISTINCT FROM 'Asia/Ho_Chi_Minh';
ALTER TABLE electronic_signature_settings ALTER COLUMN signature_timezone SET DEFAULT 'Asia/Ho_Chi_Minh';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_user_localization_time_zone') THEN
        ALTER TABLE user_localization_preferences ADD CONSTRAINT ck_user_localization_time_zone CHECK (time_zone IS NULL OR time_zone = 'Asia/Ho_Chi_Minh');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_signature_time_zone') THEN
        ALTER TABLE electronic_signature_settings ADD CONSTRAINT ck_signature_time_zone CHECK (signature_timezone = 'Asia/Ho_Chi_Minh');
    END IF;
END $$;
