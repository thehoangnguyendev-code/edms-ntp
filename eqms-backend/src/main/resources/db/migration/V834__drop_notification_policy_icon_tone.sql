-- The colour of the icon of an in-app notification is no longer chosen: it follows the priority of the notification (Low green, Medium yellow, High red).
ALTER TABLE notification_policies DROP COLUMN IF EXISTS icon_tone;
