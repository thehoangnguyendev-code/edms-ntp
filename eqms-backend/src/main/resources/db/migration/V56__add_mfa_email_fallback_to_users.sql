-- V56: Add MFA email fallback setting to app_users
-- This allows users to control whether email OTP is available as a fallback
-- when authenticator app is disabled

ALTER TABLE app_users
ADD COLUMN mfa_email_fallback_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN app_users.mfa_email_fallback_enabled IS 'Whether email OTP fallback is enabled when authenticator app is unavailable';

-- Backfill: Enable email fallback for all existing users by default
UPDATE app_users
SET mfa_email_fallback_enabled = true
WHERE mfa_email_fallback_enabled IS NULL;
