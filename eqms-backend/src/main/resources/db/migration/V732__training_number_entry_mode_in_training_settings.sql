-- V732: how a Training Number is given (AUTO = the system issues it, MANUAL = the person creating the document types it) belongs to Training
-- Properties, next to the other settings of Training Management (version-checked, audited, training.settings.manage), not to Document Properties.
ALTER TABLE training_settings ADD COLUMN IF NOT EXISTS training_number_entry_mode VARCHAR(10) NOT NULL DEFAULT 'AUTO';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_training_settings_number_entry_mode') THEN
        ALTER TABLE training_settings ADD CONSTRAINT ck_training_settings_number_entry_mode CHECK (training_number_entry_mode IN ('AUTO', 'MANUAL'));
    END IF;
END $$;

-- A value already saved under Document Properties (the first place of this setting) is carried over and removed there.
UPDATE training_settings SET training_number_entry_mode = 'MANUAL'
WHERE EXISTS (SELECT 1 FROM system_configurations WHERE documents_config ->> 'trainingNumberEntryMode' = 'MANUAL');
UPDATE system_configurations SET documents_config = documents_config - 'trainingNumberEntryMode'
WHERE documents_config ? 'trainingNumberEntryMode';
