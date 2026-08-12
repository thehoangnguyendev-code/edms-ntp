CREATE TABLE IF NOT EXISTS notification_delivery_failures (
    id UUID PRIMARY KEY,
    recipient VARCHAR(255) NOT NULL,
    notification_type VARCHAR(120) NOT NULL,
    event_domain VARCHAR(80),
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'FAILED'
);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_failures_status_created
    ON notification_delivery_failures (status, created_at);
