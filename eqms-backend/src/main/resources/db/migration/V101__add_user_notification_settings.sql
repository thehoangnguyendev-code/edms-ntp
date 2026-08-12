-- V101: Store per-user email notification preferences
-- Primary email continues to come from app_users.email.
-- This migration adds a user-level toggle and an optional secondary recipient email.

ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS secondary_notification_email VARCHAR(255);

UPDATE app_users
SET email_notifications_enabled = COALESCE(email_notifications_enabled, TRUE)
WHERE email_notifications_enabled IS NULL;
