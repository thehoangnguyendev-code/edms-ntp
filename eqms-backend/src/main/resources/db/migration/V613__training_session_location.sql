-- Where a session takes place: on site (venue holds the room) or online (platform and meeting link).
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS location_type VARCHAR(10) NOT NULL DEFAULT 'ONSITE';
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS online_platform VARCHAR(30);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS meeting_link TEXT;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_training_sessions_location') THEN
        ALTER TABLE training_sessions ADD CONSTRAINT ck_training_sessions_location CHECK (location_type IN ('ONSITE', 'ONLINE'));
    END IF;
END $$;
