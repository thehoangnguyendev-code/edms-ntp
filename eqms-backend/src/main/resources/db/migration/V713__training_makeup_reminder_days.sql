-- A person who was absent (or could not read a self-reading) and still has no make-up training (SOP.0003 5.3.7: "reschedule as appropriate") is reminded to the organizer
-- this many days after the due date of the training, every week, until a make-up training lists the person (owner decision 2026-10-31, D-SRM-6).
ALTER TABLE training_settings ADD COLUMN IF NOT EXISTS makeup_reminder_days INTEGER NOT NULL DEFAULT 14;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_training_settings_makeup_reminder') THEN
        ALTER TABLE training_settings ADD CONSTRAINT ck_training_settings_makeup_reminder CHECK (makeup_reminder_days BETWEEN 1 AND 365);
    END IF;
END $$;
