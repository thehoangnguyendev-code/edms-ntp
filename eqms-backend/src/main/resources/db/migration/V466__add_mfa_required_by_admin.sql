-- Per-user admin-mandated MFA requirement, independent of the user's own self-service
-- mfa_enabled toggle and of the global "Enforce Two-Factor Authentication" security setting.
-- Effective requirement = (global enable2FA) OR (this flag). See AuthService/UserManagementService.
ALTER TABLE app_users
    ADD COLUMN mfa_required_by_admin BOOLEAN NOT NULL DEFAULT FALSE;
