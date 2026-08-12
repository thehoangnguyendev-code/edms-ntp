-- V370 seeded notification_event_definitions + notification_policies for the 3 previously-
-- orphaned events (user.account_suspended, user.account_terminated, access_review.campaign_due)
-- but not their content -- NotificationDispatcher.dispatch() renders NotificationTemplateVersion
-- rows, so without an ACTIVE IN_APP version the dispatch silently produces nothing (no
-- resolvedRecipients-empty warning either, since recipients did resolve; it just has no content
-- to render). Found via live verification, not just review -- see
-- NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md Phase 1 progress notes.
INSERT INTO notification_template_versions (policy_id, channel, version_number, status, title, summary, variables_used)
SELECT p.id, 'IN_APP', 1, 'ACTIVE', v.title, v.summary, v.variables
FROM notification_policies p
JOIN (VALUES
    ('user.account_suspended', 'Account suspended', 'Your account has been suspended by an administrator.', 'recipientName'),
    ('user.account_terminated', 'Account terminated', 'Your account has been terminated by an administrator.', 'recipientName'),
    ('access_review.campaign_due', 'Access review due soon', 'Access review campaign "{{campaignName}}" is due on {{dueDate}}.', 'recipientName,campaignName,dueDate')
) AS v(event_code, title, summary, variables) ON v.event_code = p.event_code
WHERE NOT EXISTS (
    SELECT 1 FROM notification_template_versions tv WHERE tv.policy_id = p.id AND tv.channel = 'IN_APP'
);
