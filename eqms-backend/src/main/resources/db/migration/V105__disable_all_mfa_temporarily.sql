UPDATE app_users
SET mfa_enabled = FALSE,
    mfa_email_fallback_enabled = FALSE,
    mfa_remember_device_enabled = FALSE;

DELETE FROM login_challenges;
DELETE FROM mfa_trusted_devices;
DELETE FROM mfa_factors;

