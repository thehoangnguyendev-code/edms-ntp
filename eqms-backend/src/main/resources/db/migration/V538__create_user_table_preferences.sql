-- Per-user column layout for data tables (visibility, order, pinning). One row per user and table.
-- Stored as JSON text; validated by UserTablePreferenceService on every write.
CREATE TABLE IF NOT EXISTS user_table_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    table_key VARCHAR(120) NOT NULL,
    preferences TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_user_table_preferences_user_table UNIQUE (user_id, table_key)
);
