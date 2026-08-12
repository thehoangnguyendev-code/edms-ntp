-- Notification system remediation Phase 0 (NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md):
-- 1) notification_dispatch_queue backs digest/quiet-hours deferred sends (Phase 2 consumes it;
--    created now so the schema is stable before the scheduler is written).
-- 2) notification_delivery_failures gets a channel column so admin can tell email vs future
--    telegram/whatsapp failures apart.
-- 3) app_users gets Telegram/WhatsApp linking columns (Phase 5/6).
-- 4) Three event definitions that had zero code path anywhere (confirmed via full-repo grep):
--    user.account_suspended, user.account_terminated, access_review.campaign_due. Seeded here;
--    wired to a real dispatch() call site in Phase 1.
-- Note: NotificationTemplateVersion/NotificationPolicy already support channel = 'EMAIL' at the
-- entity/column level (VARCHAR, no CHECK constraint) -- V255/V257 only deleted data and left the
-- schema itself channel-agnostic, so no ALTER is needed to "re-allow" EMAIL.

CREATE TABLE notification_dispatch_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES notification_policies(id) ON DELETE CASCADE,
    event_code VARCHAR(120) NOT NULL,
    recipient_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    rendered_subject VARCHAR(255),
    rendered_body TEXT,
    variables_snapshot JSONB,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);
CREATE INDEX idx_notification_dispatch_queue_status_scheduled
    ON notification_dispatch_queue(status, scheduled_for);
CREATE INDEX idx_notification_dispatch_queue_recipient
    ON notification_dispatch_queue(recipient_user_id, channel);

ALTER TABLE notification_delivery_failures ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL';

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(64);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS telegram_link_token VARCHAR(64);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS telegram_link_expires_at TIMESTAMPTZ;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS whatsapp_phone_number VARCHAR(32);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_users_telegram_chat_id
    ON app_users(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

INSERT INTO notification_event_definitions
    (code, name, description, module, priority, compliance_group, related_action, data_object,
     supported_channels, available_variables, is_mandatory, mandatory_reason, active, display_order)
VALUES
    ('user.account_suspended', 'User Account Suspended',
     'A user account was suspended by an administrator.', 'Security', 'HIGH', 'COMPLIANCE',
     'SUSPEND', 'USER', 'IN_APP,EMAIL', 'recipientName,actorName,suspendReason,suspendedAt',
     false, NULL, true, 100),
    ('user.account_terminated', 'User Account Terminated',
     'A user account was terminated by an administrator.', 'Security', 'HIGH', 'COMPLIANCE',
     'TERMINATE', 'USER', 'IN_APP,EMAIL', 'recipientName,actorName,terminationReason,terminatedAt',
     false, NULL, true, 101),
    ('access_review.campaign_due', 'Access Review Campaign Due',
     'An access review campaign is approaching its due date.', 'Security', 'MEDIUM', 'COMPLIANCE',
     'REVIEW_DUE', 'ACCESS_REVIEW_CAMPAIGN', 'IN_APP,EMAIL', 'recipientName,campaignName,dueDate',
     false, NULL, true, 102)
ON CONFLICT (code) DO NOTHING;

INSERT INTO notification_policies (event_code, status, enabled_channels, recipient_rules, digest_mode)
VALUES
    ('user.account_suspended', 'ACTIVE', 'IN_APP', '[{"type":"AFFECTED_USERS"}]', 'IMMEDIATE'),
    ('user.account_terminated', 'ACTIVE', 'IN_APP', '[{"type":"AFFECTED_USERS"}]', 'IMMEDIATE'),
    ('access_review.campaign_due', 'ACTIVE', 'IN_APP', '[{"type":"OWNER"}]', 'IMMEDIATE')
ON CONFLICT (event_code) DO NOTHING;
