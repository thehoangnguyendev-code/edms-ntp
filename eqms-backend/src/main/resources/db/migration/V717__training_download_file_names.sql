-- The name of the file a person downloads from Training Management (APD forms as Word or PDF) is set by the administrator in Training Properties: one pattern for each form,
-- form key -> pattern, for example {"APD.0014": "{FILE_CODE}_{EMPLOYEE_CODE}_{EMPLOYEE_NAME}_{DATE}"}. A form without a pattern uses the default of the system. Forward-only and idempotent.
ALTER TABLE training_settings ADD COLUMN IF NOT EXISTS download_file_names JSONB NOT NULL DEFAULT '{}'::jsonb;
