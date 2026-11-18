-- V805: Reset MFA of another person gets its own permission (owner decision 2026-11-18, SECURITY-AUTHORIZATION-REVIEW D4: "own permission, given to everyone who has Reset Password").
-- Until now Reset MFA used settings.user.reset_password. The new permission is given to every permission set that holds Reset Password, so nobody loses the ability today;
-- an administrator can then take it away from a set without touching Reset Password.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'settings.user.reset_mfa', 'Reset MFA of Users',
     'User Management', 'system-admin', 'user_management',
     'Remove the authenticator of another user who lost the device, with a reason and an electronic signature. The user is signed out everywhere and sets multi-factor authentication up again at the next sign-in.', 245, TRUE)
ON CONFLICT (code) DO NOTHING;

-- every permission set that holds Reset Password also holds Reset MFA
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), item.permission_set_id, mfa.id
FROM permission_set_items item
JOIN permissions held ON held.id = item.permission_id AND held.code = 'settings.user.reset_password'
JOIN permissions mfa ON mfa.code = 'settings.user.reset_mfa'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
