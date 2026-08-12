CREATE TABLE IF NOT EXISTS controlled_copy_distribution_batches (
    id UUID PRIMARY KEY,
    batch_number VARCHAR(120) NOT NULL UNIQUE,
    document_id UUID NOT NULL,
    revision_id UUID NOT NULL,
    document_number VARCHAR(100) NOT NULL,
    document_title VARCHAR(500),
    revision_number VARCHAR(50),
    quantity INTEGER NOT NULL,
    status VARCHAR(40) NOT NULL,
    status_code VARCHAR(40) NOT NULL,
    distribution_list TEXT,
    distribution_scope VARCHAR(50),
    location VARCHAR(255),
    location_code VARCHAR(120),
    request_reason TEXT,
    requested_by_user_id UUID,
    requested_at TIMESTAMP,
    distributed_by_user_id UUID,
    distributed_at TIMESTAMP,
    distribution_comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cc_distribution_batches_document FOREIGN KEY (document_id) REFERENCES documents(id),
    CONSTRAINT fk_cc_distribution_batches_revision FOREIGN KEY (revision_id) REFERENCES document_revisions(id),
    CONSTRAINT fk_cc_distribution_batches_requested_by FOREIGN KEY (requested_by_user_id) REFERENCES app_users(id),
    CONSTRAINT fk_cc_distribution_batches_distributed_by FOREIGN KEY (distributed_by_user_id) REFERENCES app_users(id)
);

ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS distribution_batch_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_controlled_copies_distribution_batch'
          AND table_name = 'controlled_copies'
    ) THEN
        ALTER TABLE controlled_copies
            ADD CONSTRAINT fk_controlled_copies_distribution_batch
            FOREIGN KEY (distribution_batch_id) REFERENCES controlled_copy_distribution_batches(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cc_distribution_batches_status ON controlled_copy_distribution_batches(status_code);
CREATE INDEX IF NOT EXISTS idx_cc_distribution_batches_document_id ON controlled_copy_distribution_batches(document_id);
CREATE INDEX IF NOT EXISTS idx_cc_distribution_batches_revision_id ON controlled_copy_distribution_batches(revision_id);
CREATE INDEX IF NOT EXISTS idx_cc_distribution_batches_requested_at ON controlled_copy_distribution_batches(requested_at);
CREATE INDEX IF NOT EXISTS idx_controlled_copies_distribution_batch_id ON controlled_copies(distribution_batch_id);
