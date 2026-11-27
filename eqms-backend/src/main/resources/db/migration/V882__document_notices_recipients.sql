-- DEC-DOC-2026-11-27-10 (owner): who is told at each step of the Document Control workflow. A policy an administrator has already changed is left as it is. Forward-only.
UPDATE notification_policies SET updated_at = now(),
  recipient_rules = '[{"type": "REVIEWER"}, {"type": "WORKFLOW_COORDINATOR"}]'::jsonb
 WHERE event_code = 'document.submitted_for_review' AND recipient_rules = '[{"type": "REVIEWER"}]'::jsonb;
UPDATE notification_policies SET updated_at = now(),
  recipient_rules = '[{"type": "APPROVER"}, {"type": "WORKFLOW_COORDINATOR"}]'::jsonb
 WHERE event_code = 'document.review_completed' AND recipient_rules = '[{"type": "AUTHOR"}, {"type": "APPROVER"}]'::jsonb;
UPDATE notification_policies SET updated_at = now(),
  recipient_rules = '[{"type": "AUTHOR"}, {"type": "CO_AUTHOR"}, {"type": "WORKFLOW_COORDINATOR"}]'::jsonb
 WHERE event_code IN ('document.review_rejected', 'document.approval_rejected') AND recipient_rules = '[{"type": "AUTHOR"}, {"type": "CO_AUTHOR"}]'::jsonb;
UPDATE notification_policies SET updated_at = now(),
  recipient_rules = '[{"type": "AUTHOR"}, {"type": "CO_AUTHOR"}, {"type": "REVIEWER"}, {"type": "APPROVER"}]'::jsonb
 WHERE event_code = 'document.published' AND recipient_rules = '[{"type": "AUTHOR"}, {"type": "REVIEWER"}, {"type": "APPROVER"}]'::jsonb;
UPDATE notification_policies SET updated_at = now(),
  recipient_rules = '[{"type": "WORKFLOW_COORDINATOR"}]'::jsonb,
  enabled_channels = CASE WHEN enabled_channels = 'IN_APP' THEN 'IN_APP,EMAIL' ELSE enabled_channels END
 WHERE event_code = 'document.approved' AND recipient_rules = '[{"type": "AUTHOR"}, {"type": "OWNER"}]'::jsonb;
UPDATE notification_policies SET updated_at = now(),
  recipient_rules = '[{"type": "AUTHOR"}, {"type": "WORKFLOW_COORDINATOR"}]'::jsonb
 WHERE event_code = 'document.expired' AND recipient_rules = '[{"type": "RECIPIENT"}]'::jsonb;
