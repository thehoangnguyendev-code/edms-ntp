-- DEC-DOC-2026-11-27-06 (owner): a rejection is told to the Author and the Co-Authors only. The sender now names only them; the policy says the same.
-- Only a policy still holding the delivered recipients is changed; one an administrator edited is left as it is. Forward-only.
UPDATE notification_policies
   SET recipient_rules = '[{"type": "AUTHOR"}, {"type": "CO_AUTHOR"}]'::jsonb, updated_at = now()
 WHERE event_code IN ('document.review_rejected', 'document.approval_rejected')
   AND recipient_rules = '[{"type": "AUTHOR"}, {"type": "REVIEWER"}]'::jsonb;
