-- NOTIFICATION-ADMIN-2026-11-12 (owner decision): every notification is always sent. There is no mandatory or optional notification, no GMP group, and
-- no signature to change a wording (only an administrator edits, and every change is written to the Audit Trail). The columns that carried the
-- distinction are dropped. Forward-only and idempotent.
ALTER TABLE notification_event_definitions DROP COLUMN IF EXISTS compliance_group;
ALTER TABLE notification_event_definitions DROP COLUMN IF EXISTS is_mandatory;
ALTER TABLE notification_event_definitions DROP COLUMN IF EXISTS mandatory_reason;
