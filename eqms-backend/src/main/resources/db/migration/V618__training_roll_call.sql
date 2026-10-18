-- Training Management, paper first (PLAN-TR-001 17.7): a quick roll-call. The trainer marks who is present and who is absent for a whole session and signs once; each
-- trainee row then carries the sign mode TRAINER_ATTESTED instead of a signature of its own. The old check allowed four values in twelve characters.
-- Forward-only and idempotent.

ALTER TABLE training_participants ALTER COLUMN sign_mode TYPE VARCHAR(20);
DO $$
DECLARE c TEXT;
BEGIN
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'training_participants'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%sign_mode%' LOOP
        EXECUTE format('ALTER TABLE training_participants DROP CONSTRAINT %I', c);
    END LOOP;
END $$;
ALTER TABLE training_participants ADD CONSTRAINT ck_training_participants_sign_mode CHECK (sign_mode IN ('ESIGN','PAPER_SCAN','ONLINE','NONE','TRAINER_ATTESTED'));

-- Days the site does not work besides Saturday and Sunday (PLAN-TR-001 17.8, WP-DAYS): they decide what "one working day" means for the time limits.
CREATE TABLE IF NOT EXISTS training_non_working_days (
    day        DATE PRIMARY KEY,
    name       VARCHAR(120) NOT NULL,
    created_by UUID REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
