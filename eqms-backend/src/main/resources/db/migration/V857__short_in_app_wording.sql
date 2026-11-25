-- NOTIFICATION-REVIEW-2026-11-25: the in-app wording of the events that started from an e-mail message was the start of the whole e-mail (up to 480 characters, "Hello ..., Scope: ...,
-- Batch Number: ..."), shown as it was in the toast. The in-app notice is one short sentence; the long text stays in the e-mail. Only wording nobody edited is replaced (it still has the
-- change summary of the first seeding). Five of the events were in-app only although their text is a full message: they are also sent by e-mail (a policy an administrator saved is not touched).
update notification_template_versions t set summary = case
    when p.event_code = 'controlled_copy.cancel_notice' then 'Controlled copy {{controlledCopyNumber}} ({{documentTitle}}, revision {{revisionNumber}}) was cancelled and must no longer be used.'
    when p.event_code = 'controlled_copy.notice' then 'Controlled copy {{controlledCopyNumber}}: {{workflowAction}}.'
    when p.event_code = 'controlled_copy.distribution_notice' then 'A new controlled copy is available: {{controlledCopyNumber}} ({{documentTitle}}, revision {{revisionNumber}}).'
    when p.event_code = 'controlled_copy.expiry_notice' then 'Controlled copy {{controlledCopyNumber}} ({{documentTitle}}) expires on {{expiryDate}}.'
    when p.event_code = 'controlled_copy.obsoleted_notice' then 'Controlled copy {{controlledCopyNumber}} is obsolete: its document was replaced. Stop using it.'
    when p.event_code = 'controlled_copy.recall_notice' then 'Controlled copy {{controlledCopyNumber}} ({{documentTitle}}) was recalled. Return it as instructed.'
    when p.event_code = 'document.approval_request' then '{{documentNumber}} - {{documentTitle}} (revision {{revisionNumber}}) is ready for your approval.'
    when p.event_code = 'document.review_request' then '{{documentNumber}} - {{documentTitle}} (revision {{revisionNumber}}) is waiting for your review.'
    when p.event_code = 'document.edit_online' then 'You can edit {{documentNumber}} - {{documentTitle}} (revision {{revisionNumber}}) online.'
    when p.event_code = 'document.publish_notice' then '{{documentNumber}} - {{documentTitle}} (revision {{revisionNumber}}) was published.'
    when p.event_code = 'document.ready_for_publishing' then '{{documentNumber}} - {{documentTitle}} (revision {{revisionNumber}}) is ready for publishing.'
    when p.event_code = 'document.ready_for_submission' then '{{documentNumber}} - {{documentTitle}}: the author finished editing; it is ready for your review.'
    when p.event_code = 'document.training_required' then 'Training has been assigned for {{documentNumber}} - {{documentTitle}} (revision {{revisionNumber}}).'
    when p.event_code = 'knowledge.share_notice' then '{{actorName}}: {{actionTitle}} - {{itemLabel}}.'
    else t.summary end,
    change_summary = 'Short in-app wording (the long text is in the e-mail)'
  from notification_policies p
 where t.policy_id = p.id and t.channel = 'IN_APP' and t.status = 'ACTIVE' and t.created_by is null
   and t.change_summary like 'Created from the e-mail message%'
   and p.event_code in ('controlled_copy.cancel_notice', 'controlled_copy.notice', 'controlled_copy.distribution_notice', 'controlled_copy.expiry_notice', 'controlled_copy.obsoleted_notice', 'controlled_copy.recall_notice', 'document.approval_request', 'document.review_request', 'document.edit_online', 'document.publish_notice', 'document.ready_for_publishing', 'document.ready_for_submission', 'document.training_required', 'knowledge.share_notice');

update notification_policies set enabled_channels = 'IN_APP,EMAIL', updated_at = now()
 where updated_by is null and enabled_channels = 'IN_APP' and event_code in ('controlled_copy.cancel_notice', 'controlled_copy.notice', 'document.edit_online', 'document.publish_notice', 'knowledge.share_notice');
