-- This feature configures in-app/webapp notifications only. Drop the multi-channel concept
-- entirely (Escalation was modeled as a "channel" but was never actually dispatched separately —
-- escalation delivery timing/recipients remain configurable via the dedicated escalation_* columns
-- on notification_policies, independent of channel).
DELETE FROM notification_template_versions WHERE channel <> 'IN_APP';

UPDATE notification_event_definitions SET supported_channels = 'IN_APP' WHERE supported_channels <> 'IN_APP';
UPDATE notification_policies SET enabled_channels = 'IN_APP' WHERE enabled_channels <> 'IN_APP';
