-- One display format for every date and time of the system: dd/MM/yyyy and dd/MM/yyyy HH:mm:ss (24 hours, zone of the site). ISO-8601 stays only on the wire and in the database.
-- 1. New electronic signatures print their timestamp in that format. The text of a signature already made (electronic_signatures.timestamp_display) is the record as it was
--    signed and is NOT changed here.
ALTER TABLE electronic_signature_settings ALTER COLUMN signature_timestamp_format SET DEFAULT 'dd/MM/uuuu HH:mm:ss';
UPDATE electronic_signature_settings
   SET signature_timestamp_format = 'dd/MM/uuuu HH:mm:ss', timestamp_format_effective_from = now()
 WHERE signature_timestamp_format <> 'dd/MM/uuuu HH:mm:ss';

-- 2. The regional format of a user and of the system configuration is no longer a choice.
UPDATE user_localization_preferences SET date_time_format = 'DD/MM/YYYY HH:mm:ss' WHERE date_time_format IS DISTINCT FROM 'DD/MM/YYYY HH:mm:ss';
UPDATE system_configurations
   SET general_config = jsonb_set(general_config, '{dateTimeFormat}', '"DD/MM/YYYY HH:mm:ss"'::jsonb, true)
 WHERE general_config->>'dateTimeFormat' IS DISTINCT FROM 'DD/MM/YYYY HH:mm:ss';

-- 3. The date format of a DATE placeholder is no longer a choice: every date printed on a document uses the display format.
UPDATE publishing_template_placeholder_styles
   SET style_json = (style_json::jsonb - 'dateFormat')::text
 WHERE style_json::jsonb ? 'dateFormat';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_user_localization_date_time_format') THEN
        ALTER TABLE user_localization_preferences
            ADD CONSTRAINT ck_user_localization_date_time_format CHECK (date_time_format IS NULL OR date_time_format = 'DD/MM/YYYY HH:mm:ss');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_signature_timestamp_format') THEN
        ALTER TABLE electronic_signature_settings
            ADD CONSTRAINT ck_signature_timestamp_format CHECK (signature_timestamp_format = 'dd/MM/uuuu HH:mm:ss');
    END IF;
END $$;
