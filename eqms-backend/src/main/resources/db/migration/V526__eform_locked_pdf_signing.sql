-- Preserve legacy runs. Only explicitly configured new executions use PDF_V1.
ALTER TABLE controlled_copies ADD COLUMN eform_signing_protocol VARCHAR(20);
ALTER TABLE eform_fill_runs ADD COLUMN signing_protocol VARCHAR(20) NOT NULL DEFAULT 'LEGACY';
ALTER TABLE eform_fill_runs ADD COLUMN pdf_locked_at TIMESTAMPTZ;
ALTER TABLE eform_fill_runs ADD COLUMN signature_slots JSONB;

CREATE TABLE eform_pdf_signature_steps (
    id UUID PRIMARY KEY,
    fill_run_id UUID NOT NULL REFERENCES eform_fill_runs(id),
    assignment_id UUID NOT NULL REFERENCES eform_signer_assignments(id),
    sequence INT NOT NULL CHECK (sequence > 0),
    role_name VARCHAR(100) NOT NULL,
    signature_id UUID NOT NULL REFERENCES electronic_signatures(id),
    source_checksum VARCHAR(128) NOT NULL,
    result_checksum VARCHAR(128) NOT NULL,
    storage_object_key VARCHAR(1024) NOT NULL,
    storage_version_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(fill_run_id, sequence),
    UNIQUE(fill_run_id, role_name),
    UNIQUE(signature_id)
);

-- External writes are not rolled back with the workflow transaction. Retain a durable
-- journal for reconciliation; never delete a potentially retained/WORM object as compensation.
CREATE TABLE eform_artifact_writes (
    id UUID PRIMARY KEY,
    fill_run_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    storage_object_key VARCHAR(1024),
    storage_version_id VARCHAR(255),
    checksum VARCHAR(128),
    error VARCHAR(1024),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_eform_artifact_writes_pending ON eform_artifact_writes(status, created_at);
