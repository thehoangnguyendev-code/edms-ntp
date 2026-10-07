-- Removes the Microsoft Entra external-identity subsystem (approved by the system owner).
-- Earlier migrations (V314-V318, V358) created the table and permissions; they are left untouched.
-- Permission codes are removed by code so the seed and the database stay in step.

-- 1. Dependency catalog rows that reference the retired codes (depends_on_code is ON DELETE RESTRICT).
DELETE FROM permission_dependencies
WHERE permission_code IN (
    'users.invite_external', 'users.resend_external_invitation', 'users.retry_external_provisioning',
    'users.disable_microsoft_access', 'users.view_external_provisioning', 'users.remove_external_identity'
)
   OR depends_on_code IN (
    'users.invite_external', 'users.resend_external_invitation', 'users.retry_external_provisioning',
    'users.disable_microsoft_access', 'users.view_external_provisioning', 'users.remove_external_identity'
);

-- 2. Grants to permission sets (cascade would also do this; explicit keeps the intent visible).
DELETE FROM permission_set_items
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE code IN (
        'users.invite_external', 'users.resend_external_invitation', 'users.retry_external_provisioning',
        'users.disable_microsoft_access', 'users.view_external_provisioning', 'users.remove_external_identity'
    )
);

-- 3. The permission definitions themselves.
DELETE FROM permissions
WHERE code IN (
    'users.invite_external', 'users.resend_external_invitation', 'users.retry_external_provisioning',
    'users.disable_microsoft_access', 'users.view_external_provisioning', 'users.remove_external_identity'
);

-- 4. Provisioning records (one per EQMS user; the Entra guest objects themselves are not touched here).
DROP TABLE IF EXISTS external_identity_provisioning;

-- 5. Office Online / Microsoft Graph connection settings stored inside the general configuration JSON.
UPDATE system_configurations
SET general_config = general_config #- '{backupSettings,officeOnline}'
WHERE general_config #> '{backupSettings,officeOnline}' IS NOT NULL;
