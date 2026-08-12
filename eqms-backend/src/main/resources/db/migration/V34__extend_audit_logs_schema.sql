ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS event_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS username VARCHAR(120),
    ADD COLUMN IF NOT EXISTS action VARCHAR(80),
    ADD COLUMN IF NOT EXISTS old_value TEXT,
    ADD COLUMN IF NOT EXISTS new_value TEXT,
    ADD COLUMN IF NOT EXISTS user_agent VARCHAR(512),
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS signature_id UUID;

UPDATE audit_logs
SET event_time = COALESCE(event_time, created_at),
    user_id = COALESCE(user_id, acted_by_user_id),
    username = COALESCE(username, (
        SELECT u.username
        FROM app_users u
        WHERE u.id = audit_logs.acted_by_user_id
    )),
    action = COALESCE(action, action_type),
    user_agent = COALESCE(user_agent, device_browser),
    reason = COALESCE(reason, comment);
