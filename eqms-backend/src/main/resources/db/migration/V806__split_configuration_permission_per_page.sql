-- V806: the permission settings.configuration.view / .manage is retired and replaced by one View and one Manage permission for each page of Configuration
-- (owner decision 2026-11-18: "2 permissions per page, give them automatically to everyone who held the old ones, remove the old ones for good, approved").
--
-- The old pair also served as a fallback of other screens that have a permission of their own (Reports, Document Administration, Notifications, Object Numbering, ...) and as the
-- only permission of two screens that are not pages of Configuration (E-Sign Config, System Information). So that nobody loses what they can do today, every permission set that
-- holds the old View / Manage is given (a) the new permissions of the 8 pages, (b) the new permissions of those two screens, and (c) the own permission of each screen that accepted the old pair.
-- Then the guard of the administrative network policy is pointed at the new Security permission, and the old pair is deleted.

-- 1. the new permissions
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'settings.config_general.view',           'View Configuration: General',           'System Configuration', 'settings', 'system_configuration', 'Open the General page of Configuration and read its history.', 290, FALSE),
    (gen_random_uuid(), 'settings.config_general.manage',         'Manage Configuration: General',         'System Configuration', 'settings', 'system_configuration', 'Change the General page of Configuration (system name, branding, login screen, dashboard layout by role, backup and maintenance defaults).', 291, TRUE),
    (gen_random_uuid(), 'settings.config_navigation_labels.view',   'View Configuration: Navigation Labels',   'System Configuration', 'settings', 'system_configuration', 'Open the Navigation Labels page of Configuration and read its history.', 292, FALSE),
    (gen_random_uuid(), 'settings.config_navigation_labels.manage', 'Manage Configuration: Navigation Labels', 'System Configuration', 'settings', 'system_configuration', 'Rename the menu entries on the Navigation Labels page of Configuration.', 293, TRUE),
    (gen_random_uuid(), 'settings.config_security.view',          'View Configuration: Security',          'System Configuration', 'settings', 'system_configuration', 'Open the Security page of Configuration (sign-in, session, password and network access settings) and read its history.', 294, FALSE),
    (gen_random_uuid(), 'settings.config_security.manage',        'Manage Configuration: Security',        'System Configuration', 'settings', 'system_configuration', 'Change the Security page of Configuration, including the administrative network policy. The emergency account of the network policy must hold this permission.', 295, TRUE),
    (gen_random_uuid(), 'settings.config_notifications.view',     'View Configuration: Notifications',     'System Configuration', 'settings', 'system_configuration', 'Open the Notifications page of Configuration and read its history.', 296, FALSE),
    (gen_random_uuid(), 'settings.config_notifications.manage',   'Manage Configuration: Notifications',   'System Configuration', 'settings', 'system_configuration', 'Change the delivery settings on the Notifications page of Configuration.', 297, TRUE),
    (gen_random_uuid(), 'settings.config_integrations.view',      'View Configuration: Integrations',      'System Configuration', 'settings', 'system_configuration', 'Open the Integrations page of Configuration (storage, mail, Office Online) and read its history.', 298, FALSE),
    (gen_random_uuid(), 'settings.config_integrations.manage',    'Manage Configuration: Integrations',    'System Configuration', 'settings', 'system_configuration', 'Change the Integrations page of Configuration, including the storage usage policy.', 299, TRUE),
    (gen_random_uuid(), 'settings.config_preview_file.view',      'View Configuration: Preview File',      'System Configuration', 'settings', 'system_configuration', 'Open the Preview File page of Configuration and read its history.', 300, FALSE),
    (gen_random_uuid(), 'settings.config_preview_file.manage',    'Manage Configuration: Preview File',    'System Configuration', 'settings', 'system_configuration', 'Change the preview options (viewer, toolbar, watermark) on the Preview File page of Configuration.', 301, TRUE),
    (gen_random_uuid(), 'settings.config_image_watermark.view',   'View Configuration: Image Watermark',   'System Configuration', 'settings', 'system_configuration', 'Open the Image Watermark page of Configuration and read its history.', 302, FALSE),
    (gen_random_uuid(), 'settings.config_image_watermark.manage', 'Manage Configuration: Image Watermark', 'System Configuration', 'settings', 'system_configuration', 'Change the Image Watermark page of Configuration.', 303, TRUE),
    (gen_random_uuid(), 'settings.config_features.view',          'View Configuration: Features',          'System Configuration', 'settings', 'system_configuration', 'Open the Features page of Configuration and read its history.', 304, FALSE),
    (gen_random_uuid(), 'settings.config_features.manage',        'Manage Configuration: Features',        'System Configuration', 'settings', 'system_configuration', 'Turn features on or off on the Features page of Configuration.', 305, TRUE),
    -- the two screens outside Configuration that had no permission of their own
    (gen_random_uuid(), 'settings.electronic_signature.view',     'View E-Sign Config',                    'System Configuration', 'settings', 'system_configuration', 'Open the E-Sign Config screen.', 306, FALSE),
    (gen_random_uuid(), 'settings.electronic_signature.manage',   'Manage E-Sign Config',                  'System Configuration', 'settings', 'system_configuration', 'Change the electronic signature settings (meanings, time stamp format and zone).', 307, TRUE),
    (gen_random_uuid(), 'settings.system_info.view',              'View System Information',               'System Configuration', 'settings', 'system_configuration', 'Open the System Information screen (server, database and technology stack facts).', 308, FALSE)
ON CONFLICT (code) DO NOTHING;

-- 2. everyone who held the old View gets the new Views, and the own View of each screen that accepted the old View
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), item.permission_set_id, target.id
FROM permission_set_items item
JOIN permissions held ON held.id = item.permission_id AND held.code = 'settings.configuration.view'
JOIN permissions target ON target.code IN (
    'settings.config_general.view', 'settings.config_navigation_labels.view', 'settings.config_security.view', 'settings.config_notifications.view',
    'settings.config_integrations.view', 'settings.config_preview_file.view', 'settings.config_image_watermark.view', 'settings.config_features.view',
    'settings.electronic_signature.view', 'settings.system_info.view',
    'reports.definition.view', 'settings.object_numbering.view', 'settings.notification_policy.view', 'settings.email_template.view',
    'documents.admin.document_types.view', 'documents.admin.name_formats.view', 'documents.admin.controlled_copies_policy.view',
    'documents.admin.uncontrolled_copies_policy.view', 'documents.admin.properties.view', 'documents.admin.publishing_templates.view')
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- 3. the same for the old Manage
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), item.permission_set_id, target.id
FROM permission_set_items item
JOIN permissions held ON held.id = item.permission_id AND held.code = 'settings.configuration.manage'
JOIN permissions target ON target.code IN (
    'settings.config_general.manage', 'settings.config_navigation_labels.manage', 'settings.config_security.manage', 'settings.config_notifications.manage',
    'settings.config_integrations.manage', 'settings.config_preview_file.manage', 'settings.config_image_watermark.manage', 'settings.config_features.manage',
    'settings.electronic_signature.manage',
    'reports.definition.manage', 'settings.object_numbering.manage', 'settings.notification_policy.manage', 'settings.email_template.manage',
    'documents.admin.document_types.manage', 'documents.admin.name_formats.manage', 'documents.admin.controlled_copies_policy.manage',
    'documents.admin.uncontrolled_copies_policy.manage', 'documents.admin.properties.manage', 'documents.admin.publishing_templates.manage')
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- 4. the guard that keeps an enabled administrative network policy from locking everybody out: the emergency account must now hold the Manage permission of the Security page
CREATE OR REPLACE FUNCTION validate_emergency_access_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    current_policy administrative_network_policy%ROWTYPE;
BEGIN
    SELECT * INTO current_policy FROM administrative_network_policy WHERE id = true;
    IF NOT FOUND OR NOT current_policy.enabled THEN
        RETURN NULL;
    END IF;
    IF current_policy.emergency_user_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM app_users u
        JOIN user_access_profiles uap ON uap.user_id = u.id
        JOIN roles r ON r.id = uap.access_profile_id AND r.is_active = true
        JOIN access_profile_permission_sets aps ON aps.access_profile_id = r.id
        JOIN permission_sets ps ON ps.id = aps.permission_set_id AND ps.active = true
        JOIN permission_set_items psi ON psi.permission_set_id = ps.id
        JOIN permissions p ON p.id = psi.permission_id
        WHERE u.id = current_policy.emergency_user_id
          AND u.status = 'Active'
          AND lower(trim(p.code)) = 'settings.config_security.manage'
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'The enabled network policy requires an active emergency account with the permission to manage the Security page of Configuration';
    END IF;
    RETURN NULL;
END;
$$;

-- 4b. the notification policies that sent a message to "everyone who holds the old Manage" now name the permission of the page the event belongs to
UPDATE notification_policies SET recipient_rules = '[{"type": "PERMISSION", "value": "settings.config_integrations.manage"}]'::jsonb
WHERE event_code = 'system.retention_blocked_deletion' AND recipient_rules::text LIKE '%settings.configuration.manage%';
UPDATE notification_policies SET recipient_rules = '[{"type": "PERMISSION", "value": "settings.config_general.manage"}]'::jsonb
WHERE event_code = 'knowledge.sharing_changed' AND recipient_rules::text LIKE '%settings.configuration.manage%';
UPDATE notification_policies SET recipient_rules = '[{"type": "ACTOR"}, {"type": "PERMISSION", "value": "settings.config_security.manage"}]'::jsonb
WHERE event_code = 'security.refresh_token_reuse' AND recipient_rules::text LIKE '%settings.configuration.manage%';
UPDATE notification_policies SET recipient_rules = '[{"type": "PERMISSION", "value": "settings.electronic_signature.manage"}]'::jsonb
WHERE event_code = 'security.esignature_settings_changed' AND recipient_rules::text LIKE '%settings.configuration.manage%';
UPDATE notification_policies SET recipient_rules = '[{"type": "PERMISSION", "value": "settings.config_general.manage"}, {"type": "PERMISSION", "value": "settings.config_navigation_labels.manage"}, {"type": "PERMISSION", "value": "settings.config_security.manage"}, {"type": "PERMISSION", "value": "settings.config_notifications.manage"}, {"type": "PERMISSION", "value": "settings.config_integrations.manage"}, {"type": "PERMISSION", "value": "settings.config_preview_file.manage"}, {"type": "PERMISSION", "value": "settings.config_image_watermark.manage"}, {"type": "PERMISSION", "value": "settings.config_features.manage"}]'::jsonb
WHERE event_code = 'system.configuration_changed' AND recipient_rules::text LIKE '%settings.configuration.manage%';

-- 5. the old pair goes for good (the rows of permission sets that held it go with it)
DELETE FROM permission_set_items
WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('settings.configuration.view', 'settings.configuration.manage'));
DELETE FROM permissions WHERE code IN ('settings.configuration.view', 'settings.configuration.manage');
