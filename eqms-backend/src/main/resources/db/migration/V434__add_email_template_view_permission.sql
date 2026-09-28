-- settings.email_template.manage existed as a seeded permission (V171) but was never actually
-- enforced by EmailTemplateController -- the controller/route checked settings.configuration.*
-- only, so a user granted email_template.manage alone saw the manage buttons render (FE capability
-- hint) but got Access Denied on the real route/API. Per Decision Log: Email Templates is now a
-- genuinely independent, delegable Settings screen, matching the settings.business_unit/.../
-- .education.* granular split (V428/V429), instead of retiring the code in favor of
-- settings.configuration.*.
--
-- Add the missing settings.email_template.view counterpart and require it for .manage, same
-- pattern as SET-10..17.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order)
VALUES
    (gen_random_uuid(), 'settings.email_template.view', 'View Email Templates', 'Application Settings', 'app-settings', 'email_templates', 'View notification email templates.', 1917)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, category = EXCLUDED.category, module_key = EXCLUDED.module_key,
    group_key = EXCLUDED.group_key, description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- Anyone already holding settings.email_template.manage implicitly needs the view counterpart to
-- satisfy the new REQUIRES rule below -- expand their grants, never revoke.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), legacy.permission_set_id, target.id
FROM permission_set_items legacy
JOIN permissions old_permission ON old_permission.id = legacy.permission_id
JOIN permissions target ON target.code = 'settings.email_template.view'
WHERE old_permission.code = 'settings.email_template.manage'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT legacy.role_id, target.id
FROM role_permissions legacy
JOIN permissions old_permission ON old_permission.id = legacy.permission_id
JOIN permissions target ON target.code = 'settings.email_template.view'
WHERE old_permission.code = 'settings.email_template.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES
    ('settings.email_template.manage', 'settings.email_template.view', 'REQUIRES', 'SET-18', 'Quản lý Email Templates cần xem được cùng resource.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;
