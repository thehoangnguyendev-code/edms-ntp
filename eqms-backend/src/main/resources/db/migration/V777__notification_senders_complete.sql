-- NOTIFICATION-ADMIN-2026-11-12 (owner: "handle all of it"): every registered notification has a sender. Forward-only and idempotent.
-- 1. Four events nobody raised are removed: the e-form signer turn (no e-form module), the preference change (a message of the preference e-mail, not an event), the access profile
--    change (the audit-driven security.access_profile_changed_audit does it) and the copy expiring soon (controlled_copy.expiry_notice is the reminder that is sent).
DELETE FROM notification_dispatch_queue WHERE policy_id IN (SELECT id FROM notification_policies WHERE event_code IN
    ('eform.signer_turn', 'system.preference_updated', 'security.access_profile_changed', 'controlled_copy.expiring_soon'));
DELETE FROM notification_template_versions WHERE policy_id IN (SELECT id FROM notification_policies WHERE event_code IN
    ('eform.signer_turn', 'system.preference_updated', 'security.access_profile_changed', 'controlled_copy.expiring_soon'));
DELETE FROM notification_policies WHERE event_code IN ('eform.signer_turn', 'system.preference_updated', 'security.access_profile_changed', 'controlled_copy.expiring_soon');
DELETE FROM notification_event_definitions WHERE code IN ('eform.signer_turn', 'system.preference_updated', 'security.access_profile_changed', 'controlled_copy.expiring_soon');

-- 2. The reminder that a controlled copy will expire was named "Expired".
UPDATE notification_event_definitions SET name = 'Controlled Copy Expiring Soon' WHERE code = 'controlled_copy.expiry_notice';

-- 3. The person who asked for a backup restore, export or inspection is told of the outcome, with the people who hold the permission; the person who exported the audit trail is
--    told it is done; the reviewer of an audit trail review campaign is told it is assigned.
UPDATE notification_policies SET recipient_rules = '[{"type": "OWNER"}, {"type": "PERMISSION", "value": "backup.restore.execute"}]'::jsonb WHERE event_code = 'backup.restore_decided';
UPDATE notification_policies SET recipient_rules = '[{"type": "OWNER"}, {"type": "PERMISSION", "value": "backup.admin.view"}]'::jsonb WHERE event_code IN ('backup.export_decided', 'backup.inspection_decided');
UPDATE notification_policies SET recipient_rules = '[{"type": "ACTOR"}]'::jsonb WHERE event_code = 'audit_trail.export_completed';
UPDATE notification_policies SET recipient_rules = '[{"type": "OWNER"}, {"type": "PERMISSION", "value": "audit.review.manage"}]'::jsonb WHERE event_code = 'audit_trail.review_campaign_assigned';

-- 4. The periodic review of a document: the reminder is claimed on the document by the review date it was sent for (once when the days before are reached, once when it is overdue).
ALTER TABLE documents ADD COLUMN IF NOT EXISTS periodic_review_notified_for DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS periodic_review_overdue_notified_for DATE;
UPDATE notification_template_versions v
SET summary = replace(v.summary, 'is due for periodic review.', '{{reviewStatus}} {{reviewDate}}.'),
    body = replace(v.body, 'is due for periodic review.', '{{reviewStatus}} {{reviewDate}}.'),
    variables_used = CASE WHEN v.variables_used LIKE '%reviewDate%' THEN v.variables_used ELSE coalesce(v.variables_used, '') || ',reviewDate,reviewStatus' END
FROM notification_policies p
WHERE v.policy_id = p.id AND p.event_code = 'document.periodic_review_due' AND (v.summary LIKE '%is due for periodic review.' OR v.body LIKE '%is due for periodic review.');

-- 5. The maintenance notice carries the words the maintenance gate composes (how many minutes, what to do).
UPDATE notification_template_versions v
SET title = '{{title}}', summary = '{{message}}', variables_used = 'title,message'
FROM notification_policies p
WHERE v.policy_id = p.id AND p.event_code = 'system.maintenance_scheduled' AND v.channel = 'IN_APP' AND v.title = 'Maintenance scheduled';
