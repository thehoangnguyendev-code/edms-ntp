-- The placeholder userName (the full name of the person) is the same thing as fullName: the two notices of a pending participant use fullName. The text of their wording (in-app and
-- e-mail, edited or not) keeps everything else; only the placeholder is renamed. The older e-mail messages still receive userName from their senders (nothing in them uses it).
update notification_template_versions t set
    title = replace(t.title, '{{userName}}', '{{fullName}}'), summary = replace(t.summary, '{{userName}}', '{{fullName}}'),
    subject = replace(t.subject, '{{userName}}', '{{fullName}}'), body = replace(t.body, '{{userName}}', '{{fullName}}'),
    variables_used = replace(t.variables_used, 'userName', 'fullName')
  from notification_policies p
 where t.policy_id = p.id and p.event_code in ('document.participant_unavailable', 'document.action_escalated');

update notification_event_definitions set available_variables = replace(available_variables, 'userName', 'fullName')
 where code in ('document.participant_unavailable', 'document.action_escalated');
