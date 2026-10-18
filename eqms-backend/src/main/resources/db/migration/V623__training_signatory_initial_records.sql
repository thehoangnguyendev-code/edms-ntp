-- Training Management (SOP.0003 5.1, TR-33, owner decision 2026-10-18, proposal D-45): the people who signed a document (prepared, reviewed, approved) are taken to have had the initial
-- training on it. When the revision is approved, a training record of source SIGNATORY_INITIAL is written for each of them, once for each person and activity.
-- Forward-only and idempotent.

DO $$
DECLARE c TEXT;
BEGIN
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'training_records'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%LEGACY_IMPORT%' LOOP
        EXECUTE format('ALTER TABLE training_records DROP CONSTRAINT %I', c);
    END LOOP;
END $$;
ALTER TABLE training_records DROP CONSTRAINT IF EXISTS ck_training_records_source;
ALTER TABLE training_records ADD CONSTRAINT ck_training_records_source CHECK (source IN ('ACTIVITY','LEGACY_IMPORT','SIGNATORY_INITIAL'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_training_records_signatory ON training_records (person_user_id, activity_id) WHERE source = 'SIGNATORY_INITIAL';
