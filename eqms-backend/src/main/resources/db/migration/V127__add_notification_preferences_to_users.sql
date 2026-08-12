ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS notification_preferences TEXT;

UPDATE app_users
SET notification_preferences = COALESCE(notification_preferences, '{}')
WHERE notification_preferences IS NULL;

ALTER TABLE app_users
    ALTER COLUMN notification_preferences SET DEFAULT '{}';

ALTER TABLE app_users
    ALTER COLUMN notification_preferences SET NOT NULL;
