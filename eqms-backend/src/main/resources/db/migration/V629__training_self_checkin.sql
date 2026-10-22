-- Training Management, paper first (PLAN-TR-001 17.7): trainees confirm their own attendance. The trainer opens a check-in for a held session; the screen shows a code that
-- changes every few minutes; the trainee types or scans it and signs. A trainee without a phone is still marked by the trainer (sign mode TRAINER_ATTESTED).
-- Forward-only and idempotent.

DO $$
DECLARE c TEXT;
BEGIN
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'training_participants'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%sign_mode%' LOOP
        EXECUTE format('ALTER TABLE training_participants DROP CONSTRAINT %I', c);
    END LOOP;
END $$;
ALTER TABLE training_participants ADD CONSTRAINT ck_training_participants_sign_mode CHECK (sign_mode IN ('ESIGN','PAPER_SCAN','ONLINE','NONE','TRAINER_ATTESTED','SELF'));

CREATE TABLE IF NOT EXISTS training_session_checkins (
    session_id        UUID PRIMARY KEY REFERENCES training_sessions(id),
    opened_by         UUID NOT NULL REFERENCES app_users(id),
    opened_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at         TIMESTAMPTZ,
    closed_by         UUID REFERENCES app_users(id),
    code              VARCHAR(6) NOT NULL,
    previous_code     VARCHAR(6),
    code_issued_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), 'TRAINING_ATTENDANCE_SELF_CONFIRMED', 'Attendance Confirmed by Trainee'
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = 'TRAINING_ATTENDANCE_SELF_CONFIRMED');
