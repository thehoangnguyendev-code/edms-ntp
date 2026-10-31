-- Existing queued messages remain readable. All messages enqueued by the new worker are encrypted.
ALTER TABLE notification_email_outbox ADD COLUMN encryption_version VARCHAR(32);
