-- Training Management: how each person takes part in a training (decision of the owner 2026-10-28).
-- TRAINEE (default) takes the assessment; TRAINER, ATTENDEE (attends, no assessment) and NAME_ONLY (listed, informed, does not sign) do not.
-- Every role other than TRAINEE needs a reason; who set it and when stay on the row (the Audit Trail keeps the change).
-- A person who does not take the assessment is recorded as having done the training: the record says TRAINER or ATTENDED instead of PASSED.
ALTER TABLE training_participants ADD COLUMN IF NOT EXISTS participation_role VARCHAR(12) NOT NULL DEFAULT 'TRAINEE';
ALTER TABLE training_participants ADD COLUMN IF NOT EXISTS participation_reason TEXT;
ALTER TABLE training_participants ADD COLUMN IF NOT EXISTS participation_set_by UUID REFERENCES app_users(id);
ALTER TABLE training_participants ADD COLUMN IF NOT EXISTS participation_set_at TIMESTAMPTZ;
ALTER TABLE training_participants DROP CONSTRAINT IF EXISTS ck_training_participants_role;
ALTER TABLE training_participants ADD CONSTRAINT ck_training_participants_role CHECK (participation_role IN ('TRAINEE', 'TRAINER', 'ATTENDEE', 'NAME_ONLY'));
ALTER TABLE training_participants DROP CONSTRAINT IF EXISTS ck_training_participants_role_reason;
ALTER TABLE training_participants ADD CONSTRAINT ck_training_participants_role_reason
    CHECK (participation_role = 'TRAINEE' OR coalesce(btrim(participation_reason), '') <> '');

ALTER TABLE training_records DROP CONSTRAINT IF EXISTS training_records_result_check;
ALTER TABLE training_records ADD CONSTRAINT training_records_result_check CHECK (result IN ('PASSED', 'READ', 'ATTENDED', 'TRAINER'));
