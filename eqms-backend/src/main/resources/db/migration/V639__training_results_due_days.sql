-- SOP.0003 5.3.7: after the training assessment the results go to QA within a number of days. The SOP says "working days" but the site has not defined them, so the
-- number is counted in calendar days from the day the training was held and is set in Training Properties (default 7). No calendar of non-working days is kept.
ALTER TABLE training_settings ADD COLUMN IF NOT EXISTS results_due_days INTEGER NOT NULL DEFAULT 7;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_training_settings_results_due_days') THEN
        ALTER TABLE training_settings ADD CONSTRAINT ck_training_settings_results_due_days CHECK (results_due_days BETWEEN 1 AND 60);
    END IF;
END $$;
