-- Backup policy changes (SDS-BR-001 sections 6.1 and 24, decisions BR-6 to BR-10). Seeing the policy is V556
-- (backup.admin.policy.view). Proposing a new version and approving it are separate permissions so an Access Profile can give
-- them to different people; the Backup Agent additionally refuses an activation by the person who proposed the version.
-- Both are audited, and approving carries an electronic signature.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'backup.admin.policy.propose', 'Propose Backup Policy Change',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'Propose a new version of the backup policy (scope, targets, schedule) or discard a draft. The change does not take effect until another person approves it.', 205, TRUE),
    (gen_random_uuid(), 'backup.admin.policy.approve', 'Approve Backup Policy Change',
     'Backup & Restore Administration', 'backup', 'backup_admin',
     'Approve and activate a proposed backup policy version with an electronic signature. Refused unless the policy meets the 3-2-1-1 rule.', 206, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES
    ('backup.admin.policy.propose', 'backup.admin.policy.view', 'REQUIRES', 'BKP-03', 'Proposing a policy change requires seeing the current policy.'),
    ('backup.admin.policy.approve', 'backup.admin.policy.view', 'REQUIRES', 'BKP-04', 'Approving a policy change requires seeing the policy and its gate result.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('backup.admin.policy.propose', 'backup.admin.policy.approve')
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- Meaning shown on the electronic signature when a policy version is approved.
INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES (gen_random_uuid(), 'BACKUP_POLICY_CHANGE', 'Backup Policy Change')
ON CONFLICT (code) DO NOTHING;
