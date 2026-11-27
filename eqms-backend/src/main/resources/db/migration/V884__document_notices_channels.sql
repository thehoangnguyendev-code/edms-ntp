-- DEC-DOC-2026-11-27-11 (owner): "Document Approved" is told to Document Control by e-mail only; a controlled copy that is distributed is told in the app only, because
-- its e-mail (with the link and the password to view it) is the message of the copy. Only policies still on the delivered channels are changed. Forward-only.
UPDATE notification_policies SET enabled_channels = 'EMAIL', updated_at = now()
 WHERE event_code = 'document.approved' AND enabled_channels = 'IN_APP,EMAIL' AND recipient_rules = '[{"type": "WORKFLOW_COORDINATOR"}]'::jsonb;
UPDATE notification_policies SET enabled_channels = 'IN_APP', updated_at = now()
 WHERE event_code = 'controlled_copy.distributed' AND enabled_channels = 'IN_APP,EMAIL';
