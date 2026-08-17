-- "Require password before signing" and "Allowed Auth Method" never controlled real behavior:
-- allowed_auth_method was hardcoded to 'PASSWORD' by the application on every save (electronic
-- signatures are password-only per GMP/21 CFR Part 11 -- no alternative method was ever wired up),
-- and require_password_before_signing was stored/echoed but never read anywhere to conditionally
-- skip password verification in the actual signing flow. Both were decorative-only UI controls
-- that implied a configurability that never existed. Removing them entirely.
ALTER TABLE electronic_signature_settings DROP COLUMN require_password_before_signing;
ALTER TABLE electronic_signature_settings DROP COLUMN allowed_auth_method;
