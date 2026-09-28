-- The three workflow events added with V447 were seeded with recipient rule types the dispatcher does
-- not resolve (DCO, REVIEWER/APPROVER without context). The business module supplies the exact people,
-- so the policies must use the contextual RECIPIENT rule.
UPDATE notification_policies
SET recipient_rules = '[{"type":"RECIPIENT"}]'::jsonb
WHERE event_code IN ('document.participant_unavailable', 'document.action_reminder', 'document.action_escalated');
