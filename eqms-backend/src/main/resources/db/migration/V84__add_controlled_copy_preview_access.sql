ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS recipient_user_id UUID,
    ADD COLUMN IF NOT EXISTS access_token VARCHAR(128),
    ADD COLUMN IF NOT EXISTS access_token_issued_at TIMESTAMP;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_controlled_copies_recipient_user'
    ) THEN
        ALTER TABLE controlled_copies
            ADD CONSTRAINT fk_controlled_copies_recipient_user
            FOREIGN KEY (recipient_user_id) REFERENCES app_users(id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_controlled_copies_access_token
    ON controlled_copies(access_token)
    WHERE access_token IS NOT NULL;
