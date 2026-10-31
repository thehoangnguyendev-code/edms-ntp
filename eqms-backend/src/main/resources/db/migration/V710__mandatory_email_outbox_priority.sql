ALTER TABLE notification_email_outbox ADD COLUMN priority SMALLINT NOT NULL DEFAULT 0;
UPDATE notification_email_outbox o SET priority=100
FROM notification_event_definitions e WHERE e.code=o.event_code AND e.is_mandatory=true AND o.status='PENDING';
CREATE INDEX idx_notification_email_outbox_priority ON notification_email_outbox(priority DESC,created_at) WHERE status='PENDING';
