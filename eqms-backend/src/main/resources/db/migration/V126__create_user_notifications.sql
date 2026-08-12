CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY,
    recipient_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    scope VARCHAR(20) NOT NULL DEFAULT 'personal',
    type VARCHAR(120) NOT NULL,
    module VARCHAR(120) NOT NULL,
    module_key VARCHAR(120),
    title VARCHAR(255) NOT NULL,
    message TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'unread',
    action_url VARCHAR(512),
    related_entity_type VARCHAR(80),
    related_entity_id UUID,
    related_entity_number VARCHAR(120),
    related_entity_title VARCHAR(255),
    metadata JSONB,
    read_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_created_at
    ON user_notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_status
    ON user_notifications (recipient_user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_scope
    ON user_notifications (recipient_user_id, scope);

CREATE INDEX IF NOT EXISTS idx_user_notifications_deleted_at
    ON user_notifications (deleted_at);
