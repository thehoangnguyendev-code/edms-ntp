-- NOTIFICATION-ADMIN-2026-11-12: a personal calendar event reminds its owner (notification event calendar.event_reminder). reminded_at says it was done, so the
-- reminder is sent once; moving the event clears it so the reminder is sent again for the new time. Forward-only and idempotent.
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION calendar_events_clear_reminder() RETURNS trigger AS $$
BEGIN
    IF NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.all_day IS DISTINCT FROM OLD.all_day THEN
        NEW.reminded_at := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calendar_events_clear_reminder ON calendar_events;
CREATE TRIGGER trg_calendar_events_clear_reminder BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION calendar_events_clear_reminder();

-- events that already started or are already past are not reminded after the fact
UPDATE calendar_events SET reminded_at = now() WHERE reminded_at IS NULL AND starts_at < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh');

CREATE INDEX IF NOT EXISTS idx_calendar_events_reminder ON calendar_events(starts_at) WHERE deleted_at IS NULL AND reminded_at IS NULL;
