-- NOTIFICATION-ADMIN-2026-11-12: a module is one fixed list; the registry stores its key. Events that were seeded with the label
-- ("Security", "Document Control") are written with the key, like the others. Forward-only and idempotent.
UPDATE notification_event_definitions
SET module = upper(regexp_replace(trim(module), '[^A-Za-z0-9]+', '_', 'g'))
WHERE module IS NOT NULL AND module <> upper(regexp_replace(trim(module), '[^A-Za-z0-9]+', '_', 'g'));
