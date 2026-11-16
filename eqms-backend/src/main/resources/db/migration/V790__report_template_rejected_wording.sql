-- REPORT-TEMPLATE-REJECT-NOTICE-2026-11-15: the notice to the author of a rejected report template says which template, who rejected it and the reason.
-- The event is created at start-up (NotificationEventCatalogBootstrap, with this wording for a new database); this migration gives the same wording to a database that already has it,
-- when nobody has changed the generic wording it was created with.
UPDATE notification_template_versions v
SET summary = '{{entityName}} was rejected by {{actorName}}. Reason: {{actionComment}}',
    variables_used = 'entityName,actorName,actionComment'
FROM notification_policies p
WHERE v.policy_id = p.id AND p.event_code = 'report.template_rejected' AND v.channel = 'IN_APP' AND v.status = 'ACTIVE'
  AND v.summary = '{{actionName}}: {{entityName}} by {{actorName}}. {{actionComment}}';

UPDATE notification_template_versions v
SET subject = '[EQMS] Report Template Rejected: {{entityName}}',
    body = '<p>The report template <b>{{entityName}}</b> was rejected by {{actorName}}.</p><p><b>Reason:</b> {{actionComment}}</p><p>Change the template and submit it again: {{actionUrl}}</p>',
    variables_used = 'entityName,actorName,actionComment,actionUrl'
FROM notification_policies p
WHERE v.policy_id = p.id AND p.event_code = 'report.template_rejected' AND v.channel = 'EMAIL' AND v.status = 'ACTIVE'
  AND v.subject = '[EQMS] Report Template Rejected' AND v.body = '<p>{{actionName}}: {{entityName}} by {{actorName}}. {{actionComment}}</p>';
