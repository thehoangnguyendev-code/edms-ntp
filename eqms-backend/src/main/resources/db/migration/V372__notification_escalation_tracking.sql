-- NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md Phase 2: NotificationEscalationScheduler needs to know
-- which unread notifications it has already escalated once, so a 5-10 minute cron doesn't
-- re-escalate the same notification on every run.
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_user_notifications_escalation_scan
    ON user_notifications (status, escalated_at, created_at) WHERE deleted_at IS NULL;
