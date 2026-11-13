-- NOTIFICATION-ADMIN-2026-11-12: the in-app notification and the e-mail of an event are edited separately; the description of the events created from an e-mail
-- message (V-less seed, D17) no longer says they share one wording. Forward-only and idempotent.
UPDATE notification_event_definitions
SET description = replace(description, '. The in-app notification and the e-mail share this wording.', '. Its in-app wording and its e-mail wording started from that message and are edited separately.')
WHERE description LIKE 'Raised by the module as the e-mail message%' AND description LIKE '%share this wording.';
