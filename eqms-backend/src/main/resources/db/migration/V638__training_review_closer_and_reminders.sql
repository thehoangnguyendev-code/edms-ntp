-- A training review is closed by a person who is chosen when the review is opened, like the other signing steps; only that person is reminded.
-- The two delays of the reminders are set in Training Properties.
INSERT INTO training_approval_modes (step_code, designation_mode) VALUES ('REVIEW_CLOSE', 'DESIGNATED_REQUIRED')
ON CONFLICT (step_code) DO NOTHING;

ALTER TABLE training_settings ADD COLUMN IF NOT EXISTS review_ready_reminder_days INTEGER NOT NULL DEFAULT 3;
ALTER TABLE training_settings ADD COLUMN IF NOT EXISTS review_open_reminder_days INTEGER NOT NULL DEFAULT 14;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_training_settings_review_ready_days') THEN
        ALTER TABLE training_settings ADD CONSTRAINT ck_training_settings_review_ready_days CHECK (review_ready_reminder_days BETWEEN 1 AND 60);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_training_settings_review_open_days') THEN
        ALTER TABLE training_settings ADD CONSTRAINT ck_training_settings_review_open_days CHECK (review_open_reminder_days BETWEEN 1 AND 365);
    END IF;
END $$;
