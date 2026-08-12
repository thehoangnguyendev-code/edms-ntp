-- 1. Add columns to documents table
ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS obsoleted_by_user_id UUID,
    ADD COLUMN IF NOT EXISTS obsoleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

ALTER TABLE documents
    ADD CONSTRAINT fk_documents_obsoleted_by FOREIGN KEY (obsoleted_by_user_id) REFERENCES app_users(id),
    ADD CONSTRAINT fk_documents_cancelled_by FOREIGN KEY (cancelled_by_user_id) REFERENCES app_users(id);

-- 2. Add columns to document_revisions table
ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS rejected_by_user_id UUID,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS obsoleted_by_user_id UUID,
    ADD COLUMN IF NOT EXISTS obsoleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

ALTER TABLE document_revisions
    ADD CONSTRAINT fk_document_revisions_rejected_by FOREIGN KEY (rejected_by_user_id) REFERENCES app_users(id),
    ADD CONSTRAINT fk_document_revisions_obsoleted_by FOREIGN KEY (obsoleted_by_user_id) REFERENCES app_users(id),
    ADD CONSTRAINT fk_document_revisions_cancelled_by FOREIGN KEY (cancelled_by_user_id) REFERENCES app_users(id);

-- 3. Add columns to controlled_copies table
ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS obsoleted_by_user_id UUID,
    ADD COLUMN IF NOT EXISTS obsoleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

ALTER TABLE controlled_copies
    ADD CONSTRAINT fk_controlled_copies_obsoleted_by FOREIGN KEY (obsoleted_by_user_id) REFERENCES app_users(id),
    ADD CONSTRAINT fk_controlled_copies_cancelled_by FOREIGN KEY (cancelled_by_user_id) REFERENCES app_users(id);
