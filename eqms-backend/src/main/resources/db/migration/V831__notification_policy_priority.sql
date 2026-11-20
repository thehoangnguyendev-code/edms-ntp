-- The priority of a notification can be set by an administrator (Low, Medium or High). NULL keeps the default of the event in the catalog
-- (notification_event_definitions.priority), so the catalog stays the single source of the defaults and a notification can be put back to it.
-- CRITICAL is only ever the default of a catalog event; an administrator cannot choose it.
ALTER TABLE notification_policies ADD COLUMN IF NOT EXISTS priority VARCHAR(20);

ALTER TABLE notification_policies DROP CONSTRAINT IF EXISTS chk_notification_policies_priority;
ALTER TABLE notification_policies
    ADD CONSTRAINT chk_notification_policies_priority CHECK (priority IS NULL OR priority IN ('LOW', 'MEDIUM', 'HIGH'));

COMMENT ON COLUMN notification_policies.priority IS 'Administrator-chosen priority (LOW, MEDIUM, HIGH) of the notification; NULL = the default of the catalog event.';
