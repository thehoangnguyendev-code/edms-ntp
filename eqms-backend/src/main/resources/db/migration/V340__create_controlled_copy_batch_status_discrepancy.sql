CREATE TABLE controlled_copy_batch_status_discrepancies (
    id UUID PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES controlled_copy_distribution_batches(id),
    batch_number VARCHAR(120) NOT NULL,
    expected_status_code VARCHAR(40) NOT NULL,
    actual_status_code VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL,
    last_checked_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX ux_ccbsd_open_batch
    ON controlled_copy_batch_status_discrepancies (batch_id)
    WHERE status = 'OPEN';

CREATE INDEX ix_ccbsd_status ON controlled_copy_batch_status_discrepancies (status);
