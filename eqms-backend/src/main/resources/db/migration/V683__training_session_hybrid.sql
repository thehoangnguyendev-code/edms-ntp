-- Training Management: a session can be held on site, online, or both at once (HYBRID: the place and the platform with the link are both written).
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS ck_training_sessions_location;
ALTER TABLE training_sessions ADD CONSTRAINT ck_training_sessions_location CHECK (location_type IN ('ONSITE', 'ONLINE', 'HYBRID'));
