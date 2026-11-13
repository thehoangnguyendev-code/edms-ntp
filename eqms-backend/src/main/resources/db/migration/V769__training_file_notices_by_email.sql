-- NOTIFICATION-ADMIN-2026-11-12: the e-mail of two Training notices carries a PDF (the attendance list APD.0117, the results sent to QA). It was sent by Training
-- Management directly; the outbox now carries a file, so these notices go through the registry like the others. A policy created while they were in-app only
-- gets the e-mail on (it was always sent) and wording to start from. Forward-only and idempotent.
UPDATE notification_policies
SET enabled_channels = 'IN_APP,EMAIL'
WHERE event_code IN ('training.attendance_sent', 'training.submitted_to_qa')
  AND enabled_channels NOT LIKE '%EMAIL%';

INSERT INTO notification_template_versions (policy_id, channel, version_number, status, subject, body, action_url_template, action_label, variables_used, change_summary)
SELECT p.id, 'EMAIL', 1, 'ACTIVE', '[EQMS] {{title}}', '<p>{{message}}</p>', '{{actionUrl}}', 'Open in EQMS', 'title,message,actionUrl',
       'Seeded default content'
FROM notification_policies p
WHERE p.event_code IN ('training.attendance_sent', 'training.submitted_to_qa')
  AND NOT EXISTS (SELECT 1 FROM notification_template_versions v WHERE v.policy_id = p.id AND v.channel = 'EMAIL');
