-- V711 (owner decision 2026-10-31, option B): printing the paper packs of a training is part of conducting or organizing it.
-- The separate permission training.paper.print is removed; permission_set_items.permission_id has ON DELETE CASCADE,
-- so every permission set's grant of it goes with it. TrainingPaperService and TrainingExamPackService now require
-- training.activity.conduct or training.activity.organize.
DELETE FROM permissions WHERE code = 'training.paper.print';

-- Self-reading is read by every invited person (owner decision 2026-10-31): the person who has not signed is reminded
-- this many days before the due date of the training (two reminders, both set in Training Properties), and the trainer
-- can remind one person by hand; the time of the last reminder is kept on the participant.
ALTER TABLE training_settings ADD COLUMN IF NOT EXISTS self_reading_reminder_first_days INTEGER NOT NULL DEFAULT 3;
ALTER TABLE training_settings ADD COLUMN IF NOT EXISTS self_reading_reminder_second_days INTEGER NOT NULL DEFAULT 1;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_training_settings_self_reading_first') THEN
        ALTER TABLE training_settings ADD CONSTRAINT ck_training_settings_self_reading_first CHECK (self_reading_reminder_first_days BETWEEN 1 AND 30);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_training_settings_self_reading_second') THEN
        ALTER TABLE training_settings ADD CONSTRAINT ck_training_settings_self_reading_second CHECK (self_reading_reminder_second_days BETWEEN 1 AND 30);
    END IF;
END $$;

ALTER TABLE training_participants ADD COLUMN IF NOT EXISTS last_read_reminder_at TIMESTAMP WITH TIME ZONE;
