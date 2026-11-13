-- The notifications the Audit Trail raises were stored as the two words {{title}} and {{message}}: the screen showed no wording and the administrator could not edit it.
-- They now hold real wording (owner decision 2026-11-13): the in-app title is the name of the event; the message and the e-mail say what was done, to which record, by whom
-- and with which comment, with placeholders the sender really supplies. Only wording nobody has changed is rewritten.

-- the placeholder that says what was done is offered by these events
UPDATE notification_event_definitions
SET available_variables = available_variables || ',actionName'
WHERE code IN ('audit_trail.review_campaign_assigned','audit_trail.export_completed','access_review.campaign_assigned','document.review_comment','uncontrolled_copy.expired','uncontrolled_copy.request_decided','backup.inspection_decided','backup.store_scrub_started','report.type_or_property_changed','security.permission_set_changed','security.sod_constraint_changed','security.object_access_rule_changed','system.retention_blocked_deletion','knowledge.sharing_changed','document.legacy_import_finished','document.number_changed','document.editing_lock_changed','controlled_copy.request_decided','controlled_copy.recall_evidence_uploaded','controlled_copy.reissue_requested','backup.restore_requested','backup.restore_decided','backup.export_decided','backup.policy_decided','backup.rehearsal_requested','report.template_submitted','report.template_decided','access_review.campaign_changed','audit.review_campaign_changed','security.refresh_token_reuse','security.esignature_settings_changed','security.access_profile_changed_audit','system.configuration_changed','controlled_copy.requested','controlled_copy.lost_or_damaged','controlled_copy.distribution_failed','document.publishing_failed') AND available_variables NOT LIKE '%actionName%';

-- in-app
UPDATE notification_template_versions v
SET title = d.name,
    summary = '{{actionName}}: {{entityName}} by {{actorName}}. {{actionComment}}',
    variables_used = 'actionName,entityName,actorName,actionComment'
FROM notification_policies p
JOIN notification_event_definitions d ON d.code = p.event_code
WHERE v.policy_id = p.id AND v.channel = 'IN_APP' AND v.status = 'ACTIVE'
  AND p.event_code IN ('audit_trail.review_campaign_assigned','audit_trail.export_completed','access_review.campaign_assigned','document.review_comment','uncontrolled_copy.expired','uncontrolled_copy.request_decided','backup.inspection_decided','backup.store_scrub_started','report.type_or_property_changed','security.permission_set_changed','security.sod_constraint_changed','security.object_access_rule_changed','system.retention_blocked_deletion','knowledge.sharing_changed','document.legacy_import_finished','document.number_changed','document.editing_lock_changed','controlled_copy.request_decided','controlled_copy.recall_evidence_uploaded','controlled_copy.reissue_requested','backup.restore_requested','backup.restore_decided','backup.export_decided','backup.policy_decided','backup.rehearsal_requested','report.template_submitted','report.template_decided','access_review.campaign_changed','audit.review_campaign_changed','security.refresh_token_reuse','security.esignature_settings_changed','security.access_profile_changed_audit','system.configuration_changed','controlled_copy.requested','controlled_copy.lost_or_damaged','controlled_copy.distribution_failed','document.publishing_failed')
  AND v.title = '{{title}}' AND v.summary = '{{message}}';

-- e-mail
UPDATE notification_template_versions v
SET subject = '[EQMS] ' || d.name,
    body = '<p>{{actionName}}: {{entityName}} by {{actorName}}. {{actionComment}}</p>',
    variables_used = 'actionName,entityName,actorName,actionComment'
FROM notification_policies p
JOIN notification_event_definitions d ON d.code = p.event_code
WHERE v.policy_id = p.id AND v.channel = 'EMAIL' AND v.status = 'ACTIVE'
  AND p.event_code IN ('audit_trail.review_campaign_assigned','audit_trail.export_completed','access_review.campaign_assigned','document.review_comment','uncontrolled_copy.expired','uncontrolled_copy.request_decided','backup.inspection_decided','backup.store_scrub_started','report.type_or_property_changed','security.permission_set_changed','security.sod_constraint_changed','security.object_access_rule_changed','system.retention_blocked_deletion','knowledge.sharing_changed','document.legacy_import_finished','document.number_changed','document.editing_lock_changed','controlled_copy.request_decided','controlled_copy.recall_evidence_uploaded','controlled_copy.reissue_requested','backup.restore_requested','backup.restore_decided','backup.export_decided','backup.policy_decided','backup.rehearsal_requested','report.template_submitted','report.template_decided','access_review.campaign_changed','audit.review_campaign_changed','security.refresh_token_reuse','security.esignature_settings_changed','security.access_profile_changed_audit','system.configuration_changed','controlled_copy.requested','controlled_copy.lost_or_damaged','controlled_copy.distribution_failed','document.publishing_failed')
  AND v.subject = '[EQMS] {{title}}' AND v.body = '<p>{{message}}</p>';
