-- Training Management, notices to people (SDS-TR-001 section 11): every notice that is sent, or not sent and why, is kept in a log; a reminder carries a key so that the
-- same reminder is never sent twice for the same day. Forward-only and idempotent.
CREATE TABLE IF NOT EXISTS training_notification_log (
    id                UUID PRIMARY KEY,
    event_code        VARCHAR(60) NOT NULL,
    recipient_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    channel           VARCHAR(10) NOT NULL CHECK (channel IN ('IN_APP','EMAIL')),
    status            VARCHAR(12) NOT NULL CHECK (status IN ('SENT','FAILED','SKIPPED')),
    reason_code       VARCHAR(60),
    object_type       VARCHAR(40),
    object_id         UUID,
    title             VARCHAR(255),
    dedupe_key        VARCHAR(200),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_notification_dedupe ON training_notification_log (recipient_user_id, channel, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_training_notification_object ON training_notification_log (object_type, object_id, created_at);
