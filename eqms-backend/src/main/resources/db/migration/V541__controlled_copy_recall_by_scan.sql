-- V541: Recall paper Controlled Copies in bulk by scanning their QR code (Decision COPY-RECALL-SCAN-2026-10-06).
--
-- 1. Every paper Controlled Copy issued from now on may carry a QR code holding an opaque, random,
--    per-copy token (controlled_copies.scan_token). The token is only a lookup key: every other fact
--    is read from the server when the DCO confirms. Copies issued before this migration have no
--    token and keep the existing single Recall action.
-- 2. QR placement is configured in Controlled Copies Policy > PDF Markings.
-- 3. A recall batch is a two-step record: DRAFT (files uploaded, scanned for malware, QR decoded,
--    matched to copies, reviewed by the DCO) then COMMITTED with ONE electronic signature covering
--    the reviewed list. Each recalled copy gets its own audit trail entry and a scan record.
-- 4. executed_records becomes the register of returned-copy scans for ANY document type, so it
--    now also stores the scan's file name/type/size and the recall batch it came from.

ALTER TABLE controlled_copies ADD COLUMN IF NOT EXISTS scan_token VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS ux_controlled_copies_scan_token
    ON controlled_copies (scan_token) WHERE scan_token IS NOT NULL;

ALTER TABLE controlled_copy_policy_settings
    ADD COLUMN IF NOT EXISTS qr_code_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS qr_code_position VARCHAR(20) NOT NULL DEFAULT 'BOTTOM_RIGHT',
    ADD COLUMN IF NOT EXISTS qr_code_size_mm INTEGER NOT NULL DEFAULT 20;

CREATE SEQUENCE IF NOT EXISTS controlled_copy_recall_batch_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE controlled_copy_recall_batches (
    id                    UUID PRIMARY KEY,
    lock_version          BIGINT       NOT NULL DEFAULT 0,
    batch_number          VARCHAR(40)  NOT NULL UNIQUE,
    status                VARCHAR(20)  NOT NULL,
    created_by_user_id    UUID         NOT NULL REFERENCES app_users(id),
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    committed_by_user_id  UUID         REFERENCES app_users(id),
    committed_at          TIMESTAMPTZ,
    received_at           TIMESTAMPTZ,
    recall_reason         TEXT,
    signature_id          UUID,
    CONSTRAINT ck_controlled_copy_recall_batches_status CHECK (status IN ('DRAFT', 'COMMITTED', 'DISCARDED'))
);

CREATE INDEX idx_controlled_copy_recall_batches_status ON controlled_copy_recall_batches (status, created_at DESC);

CREATE TABLE controlled_copy_recall_items (
    id                    UUID PRIMARY KEY,
    batch_id              UUID         NOT NULL REFERENCES controlled_copy_recall_batches(id),
    item_no               INTEGER      NOT NULL,
    file_name             VARCHAR(255) NOT NULL,
    content_type          VARCHAR(120),
    file_size             BIGINT       NOT NULL,
    sha256                VARCHAR(64)  NOT NULL,
    stored_path           TEXT,
    storage_provider      VARCHAR(60),
    storage_bucket        VARCHAR(255),
    storage_object_key    VARCHAR(1024),
    storage_version_id    VARCHAR(255),
    virus_status          VARCHAR(20)  NOT NULL,
    virus_signature       VARCHAR(255),
    qr_status             VARCHAR(20)  NOT NULL,
    qr_value              TEXT,
    controlled_copy_id    UUID         REFERENCES controlled_copies(id),
    match_source          VARCHAR(10),
    match_status          VARCHAR(20)  NOT NULL,
    match_message         VARCHAR(500),
    excluded              BOOLEAN      NOT NULL DEFAULT FALSE,
    outcome               VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    outcome_message       VARCHAR(500),
    executed_record_id    UUID,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_controlled_copy_recall_items_position UNIQUE (batch_id, item_no)
);

CREATE INDEX idx_controlled_copy_recall_items_batch ON controlled_copy_recall_items (batch_id);
CREATE INDEX idx_controlled_copy_recall_items_copy ON controlled_copy_recall_items (controlled_copy_id);

ALTER TABLE executed_records
    ADD COLUMN IF NOT EXISTS recall_batch_id UUID REFERENCES controlled_copy_recall_batches(id),
    ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS content_type VARCHAR(120),
    ADD COLUMN IF NOT EXISTS file_size BIGINT;

CREATE INDEX IF NOT EXISTS idx_executed_records_recall_batch ON executed_records (recall_batch_id);
