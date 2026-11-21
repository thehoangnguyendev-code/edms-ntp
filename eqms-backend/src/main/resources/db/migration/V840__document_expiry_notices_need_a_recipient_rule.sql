-- API/notification review 2026-11-21: the two document-expiry events were seeded with NO recipient rule.
-- The dispatcher takes recipients only from the rules of the policy (the list the sender passes counts only
-- when a rule names a context audience), so "no recipients resolved" skipped every expiry notice: on DEV 86
-- expired documents were marked "notified" and nobody was told. Owner decision DOCUMENT-EXPIRY-2026-10-16:
-- every Active user is told, and the holders of the voided copies get their own message. DocumentExpiryNotifier
-- passes exactly those people, so the rule is RECIPIENT (the people the sender names).
-- Only a policy that still has no rule is changed: an administrator's own choice is kept.
UPDATE notification_policies
   SET recipient_rules = '[{"type": "RECIPIENT"}]'::jsonb,
       updated_at = now()
 WHERE event_code IN ('document.expired', 'document.expired_copy_holder')
   AND (recipient_rules IS NULL OR recipient_rules = '[]'::jsonb);

-- Two templates use a variable that their event did not declare, so the administrator's editor did not offer it
-- (and, for the audit review campaign, the audit sender did not supply it: the e-mail read "assigned audit review
-- campaign ." because a missing variable renders as an empty text). The sender now supplies campaignName
-- (AuditNotificationBridge); both variables are declared here.
UPDATE notification_event_definitions
   SET available_variables = available_variables || ',campaignName', updated_at = now()
 WHERE code = 'audit_trail.review_campaign_assigned'
   AND position('campaignName' IN coalesce(available_variables, '')) = 0;
UPDATE notification_event_definitions
   SET available_variables = available_variables || ',endDate', updated_at = now()
 WHERE code = 'user.time_limited_access_expired'
   AND position('endDate' IN coalesce(available_variables, '')) = 0;
