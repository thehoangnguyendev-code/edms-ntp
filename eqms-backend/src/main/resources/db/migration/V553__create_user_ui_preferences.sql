-- Per-user interface layout preferences that must follow the user to any browser (for example: the notification list pinned to the
-- side of the layout). One row per user and preference key. Stored as JSON text; the keys that exist and the shape of each value
-- are enforced by UserUiPreferenceService on every write. Personal and cosmetic: no GMP record depends on it.
CREATE TABLE IF NOT EXISTS user_ui_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    pref_key VARCHAR(80) NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_user_ui_preferences_user_key UNIQUE (user_id, pref_key)
);
