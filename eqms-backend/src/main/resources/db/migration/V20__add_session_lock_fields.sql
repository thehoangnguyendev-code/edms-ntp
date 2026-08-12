ALTER TABLE auth_sessions
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failed_reauth_count INTEGER NOT NULL DEFAULT 0;

UPDATE auth_sessions
SET status = COALESCE(status, 'ACTIVE'),
    failed_reauth_count = COALESCE(failed_reauth_count, 0)
WHERE status IS NULL OR failed_reauth_count IS NULL;
