ALTER TABLE user_localization_preferences
    ADD COLUMN IF NOT EXISTS font_family VARCHAR(32);
