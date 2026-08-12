ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS password_change_reason VARCHAR(40);

UPDATE app_users
SET password_change_reason = 'LEGACY_REQUIRED'
WHERE must_change_password = TRUE
  AND password_change_reason IS NULL;
