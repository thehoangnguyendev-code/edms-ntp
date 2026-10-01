-- V523: Form / eForm Phase 2d -- "it's your turn to sign" currently only reaches the next signer
-- as an in-app notification (EformEditSessionService#notifyNextSigner called NotificationService
-- directly, bypassing the policy-driven NotificationDispatcher used everywhere else). Switching
-- that call to NotificationDispatcher.dispatch("eform.signer_turn", ...) needs this event +
-- policy + both channels' content seeded first, or dispatch() silently renders nothing (same gap
-- V371's comment already documented for 3 other events).

INSERT INTO notification_event_definitions
    (code, name, description, module, priority, compliance_group, related_action, data_object,
     supported_channels, available_variables, is_mandatory, mandatory_reason, active, display_order)
VALUES
    ('eform.signer_turn', 'eForm Signer Turn',
     'An electronic Controlled Copy is ready for this person''s signature in the sequential signer chain.',
     'Document Control', 'MEDIUM', 'COMPLIANCE', 'SIGN', 'CONTROLLED_COPY', 'IN_APP,EMAIL',
     'recipientName,documentNumber,roleName,actionUrl', true,
     'Part of the electronic Executed Record signing chain -- a missed handoff stalls GMP record completion.',
     true, 103)
ON CONFLICT (code) DO NOTHING;

INSERT INTO notification_policies (event_code, status, enabled_channels, recipient_rules, digest_mode)
VALUES
    ('eform.signer_turn', 'ACTIVE', 'IN_APP,EMAIL', '[{"type":"RECIPIENT"}]', 'IMMEDIATE')
ON CONFLICT (event_code) DO NOTHING;

INSERT INTO notification_template_versions (policy_id, channel, version_number, status, title, summary, action_url_template, variables_used)
SELECT p.id, 'IN_APP', 1, 'ACTIVE',
       'Your turn to sign an eForm',
       '"{{roleName}}" is ready for your signature on {{documentNumber}}.',
       '{{actionUrl}}',
       'recipientName,documentNumber,roleName,actionUrl'
FROM notification_policies p
WHERE p.event_code = 'eform.signer_turn'
  AND NOT EXISTS (SELECT 1 FROM notification_template_versions tv WHERE tv.policy_id = p.id AND tv.channel = 'IN_APP');

INSERT INTO notification_template_versions (policy_id, channel, version_number, status, subject, body, variables_used)
SELECT p.id, 'EMAIL', 1, 'ACTIVE',
       'Your turn to sign -- {{documentNumber}}',
       'Hi {{recipientName}},\n\n"{{roleName}}" is ready for your signature on {{documentNumber}}.\n\nOpen it here: {{actionUrl}}',
       'recipientName,documentNumber,roleName,actionUrl'
FROM notification_policies p
WHERE p.event_code = 'eform.signer_turn'
  AND NOT EXISTS (SELECT 1 FROM notification_template_versions tv WHERE tv.policy_id = p.id AND tv.channel = 'EMAIL');
