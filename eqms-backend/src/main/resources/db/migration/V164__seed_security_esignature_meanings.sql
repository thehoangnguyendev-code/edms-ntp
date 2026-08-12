-- Security administration e-signature meanings (RBAC master plan section 16.2).
-- These are compliance evidence meanings for access-control changes and are
-- distinct from document workflow signature meanings.

INSERT INTO electronic_signature_meanings
    (id, code, display_name, description, requires_reason, comment_rule, requires_comment, active, sort_order, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'SECURITY_CONFIGURATION_CHANGE', 'Security Configuration Change', 'Signature confirming a security configuration change (object access rules, general security settings).', true, 'OPTIONAL', false, true, 910, NOW(), NOW()),
    (gen_random_uuid(), 'USER_ACCESS_CHANGE', 'User Access Change', 'Signature confirming a change to another user''s access or credentials.', true, 'OPTIONAL', false, true, 920, NOW(), NOW()),
    (gen_random_uuid(), 'ACCESS_PROFILE_CHANGE', 'Access Profile Change', 'Signature confirming a change to an access profile or its assignments.', true, 'OPTIONAL', false, true, 930, NOW(), NOW()),
    (gen_random_uuid(), 'PERMISSION_SET_CHANGE', 'Permission Set Change', 'Signature confirming a change to a permission set.', true, 'OPTIONAL', false, true, 940, NOW(), NOW()),
    (gen_random_uuid(), 'WORKFLOW_AUTHORIZATION_CHANGE', 'Workflow Authorization Change', 'Signature confirming a change to workflow authorization policies.', true, 'OPTIONAL', false, true, 950, NOW(), NOW()),
    (gen_random_uuid(), 'SOD_RULE_CHANGE', 'SoD Rule Change', 'Signature confirming a change to segregation-of-duties constraints.', true, 'OPTIONAL', false, true, 960, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;
