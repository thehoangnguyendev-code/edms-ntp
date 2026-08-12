ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS account_locked_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS account_lock_reason VARCHAR(120);

