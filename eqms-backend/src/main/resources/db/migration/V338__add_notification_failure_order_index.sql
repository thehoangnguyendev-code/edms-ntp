-- Supports the bounded administrative failure list without sorting the full table.
CREATE INDEX IF NOT EXISTS idx_notification_delivery_failures_last_attempt
    ON notification_delivery_failures (last_attempt_at DESC, id DESC);
