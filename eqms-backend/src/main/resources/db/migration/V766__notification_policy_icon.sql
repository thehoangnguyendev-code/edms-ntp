-- NOTIFICATION-ADMIN-2026-11-12: the icon of an in-app notification can be chosen per notification (the icon and the tone of its colour).
-- Empty means the icon the screens have always used for the kind of notification. Forward-only and idempotent.
ALTER TABLE notification_policies ADD COLUMN IF NOT EXISTS icon varchar(40);
ALTER TABLE notification_policies ADD COLUMN IF NOT EXISTS icon_tone varchar(20);
