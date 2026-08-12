-- Notification Policy feature is scoped to in-app/webapp notifications only.
-- Email delivery is handled separately by the Email Templates feature; remove
-- any Email-channel template content and channel references seeded earlier.
DELETE FROM notification_template_versions WHERE channel = 'EMAIL';

UPDATE notification_event_definitions
SET supported_channels = TRIM(BOTH ',' FROM REPLACE(',' || supported_channels || ',', ',EMAIL,', ','))
WHERE supported_channels LIKE '%EMAIL%';

UPDATE notification_policies
SET enabled_channels = TRIM(BOTH ',' FROM REPLACE(',' || enabled_channels || ',', ',EMAIL,', ','))
WHERE enabled_channels LIKE '%EMAIL%';
