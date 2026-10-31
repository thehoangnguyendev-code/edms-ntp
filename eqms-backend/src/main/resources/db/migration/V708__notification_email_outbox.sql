CREATE TABLE notification_email_outbox (
    id UUID PRIMARY KEY,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    event_code TEXT NOT NULL,
    event_domain TEXT,
    payload JSONB NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','SENDING','SENT','FAILED','UNKNOWN')),
    claim_id UUID,
    claimed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    error_code TEXT
);
CREATE INDEX idx_notification_email_outbox_pending ON notification_email_outbox(created_at) WHERE status='PENDING';
CREATE INDEX idx_notification_email_outbox_sending ON notification_email_outbox(claimed_at) WHERE status='SENDING';
