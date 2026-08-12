CREATE TABLE IF NOT EXISTS user_localization_preferences (
    user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
    use_system_defaults BOOLEAN NOT NULL DEFAULT TRUE,
    language VARCHAR(32),
    date_time_format VARCHAR(64),
    time_zone VARCHAR(64),
    number_format VARCHAR(32),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
