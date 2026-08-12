CREATE TABLE IF NOT EXISTS external_identity_provisioning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eqms_user_id UUID NOT NULL UNIQUE REFERENCES app_users(id),
    provider VARCHAR(40) NOT NULL DEFAULT 'MICROSOFT_ENTRA',
    email_normalized VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(120),
    object_id VARCHAR(120),
    invitation_id VARCHAR(120),
    status VARCHAR(30) NOT NULL DEFAULT 'NOT_INVITED',
    invited_at TIMESTAMPTZ,
    redeemed_at TIMESTAMPTZ,
    disabled_at TIMESTAMPTZ,
    last_error_code VARCHAR(120),
    last_error_message VARCHAR(2000),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_external_identity_provider_email UNIQUE (provider, email_normalized)
);

CREATE INDEX IF NOT EXISTS idx_external_identity_provisioning_status
    ON external_identity_provisioning(status);

INSERT INTO permissions (id, code, name, description, category, module_key, group_key, display_order, requires_audit)
VALUES
 (gen_random_uuid(), 'users.invite_external', 'Invite external user', 'Invite a user to Microsoft Entra as a guest', 'System Administration', 'settings', 'user_management', 910, true),
 (gen_random_uuid(), 'users.resend_external_invitation', 'Resend external invitation', 'Resend a Microsoft Entra guest invitation', 'System Administration', 'settings', 'user_management', 911, true),
 (gen_random_uuid(), 'users.retry_external_provisioning', 'Retry external provisioning', 'Retry a failed Microsoft Entra provisioning operation', 'System Administration', 'settings', 'user_management', 912, true),
 (gen_random_uuid(), 'users.disable_microsoft_access', 'Disable Microsoft access', 'Disable the provisioned Microsoft guest account without deleting it', 'System Administration', 'settings', 'user_management', 913, true),
 (gen_random_uuid(), 'users.view_external_provisioning', 'View external provisioning', 'View Microsoft Entra invitation and provisioning status', 'System Administration', 'settings', 'user_management', 914, false)
ON CONFLICT (code) DO UPDATE SET
 name = EXCLUDED.name,
 description = EXCLUDED.description,
 category = EXCLUDED.category,
 module_key = EXCLUDED.module_key,
 group_key = EXCLUDED.group_key,
 requires_audit = EXCLUDED.requires_audit;
