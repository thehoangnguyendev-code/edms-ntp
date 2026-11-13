-- The personal calendar is removed (owner instruction 2026-11-12: it conflicts with the notification function). Forward-only and idempotent. The personal events
-- it held are deleted with the table; no other record refers to them. Its notification event (calendar.event_reminder, V771) and the notifications already sent
-- under it are removed with it. V520 and V771 stay as they are (applied migrations are never edited); this migration undoes them.
DELETE FROM user_notifications WHERE type = 'calendar.event_reminder';
DELETE FROM notification_dispatch_queue WHERE policy_id IN (SELECT id FROM notification_policies WHERE event_code = 'calendar.event_reminder');
DELETE FROM notification_template_versions WHERE policy_id IN (SELECT id FROM notification_policies WHERE event_code = 'calendar.event_reminder');
DELETE FROM notification_policies WHERE event_code = 'calendar.event_reminder';
DELETE FROM notification_event_definitions WHERE code = 'calendar.event_reminder';

DROP TRIGGER IF EXISTS trg_calendar_events_clear_reminder ON calendar_events;
DROP FUNCTION IF EXISTS calendar_events_clear_reminder();
DROP TABLE IF EXISTS calendar_events;
