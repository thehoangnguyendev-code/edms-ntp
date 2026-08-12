DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'electronic_signatures'
          AND column_name = 'job_title'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'electronic_signatures'
          AND column_name = 'position'
    ) THEN
        EXECUTE 'ALTER TABLE electronic_signatures RENAME COLUMN job_title TO position';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'electronic_signature_settings'
          AND column_name = 'show_job_title'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'electronic_signature_settings'
          AND column_name = 'show_position'
    ) THEN
        EXECUTE 'ALTER TABLE electronic_signature_settings RENAME COLUMN show_job_title TO show_position';
    END IF;
END $$;
