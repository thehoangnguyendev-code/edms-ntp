CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active_lookup
    ON auth_sessions (user_id, revoked_at, status, expires_at);
