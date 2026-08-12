ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS localization_preferences TEXT NOT NULL DEFAULT '{}';
