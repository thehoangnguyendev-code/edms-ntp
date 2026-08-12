ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID,
    ADD COLUMN IF NOT EXISTS submitted_on TIMESTAMP;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_document_revisions_submitted_by_user'
    ) THEN
        ALTER TABLE document_revisions
            ADD CONSTRAINT fk_document_revisions_submitted_by_user
                FOREIGN KEY (submitted_by_user_id) REFERENCES app_users(id);
    END IF;
END $$;
