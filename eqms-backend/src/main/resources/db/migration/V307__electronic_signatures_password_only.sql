-- Electronic signature authentication is password-only. Account MFA/SSO remains
-- independent and is not used as a signing method.
UPDATE electronic_signature_settings
SET allowed_auth_method = 'PASSWORD'
WHERE allowed_auth_method IS DISTINCT FROM 'PASSWORD';
