-- V496: Create uncontrolled_copies table.
-- Parallel to controlled_copies but deliberately a SEPARATE table/entity (no copyType
-- discriminator): Uncontrolled Copy never grows Recall/Reconciliation/Replace-Lost-Damaged
-- fields, and its audit/validation trail must never cross-contaminate with Controlled Copy.

CREATE TABLE uncontrolled_copies (
    id                              UUID PRIMARY KEY,
    lock_version                    BIGINT NOT NULL DEFAULT 0,

    document_id                     UUID NOT NULL REFERENCES documents(id),
    revision_id                     UUID NOT NULL REFERENCES document_revisions(id),

    uncontrolled_copy_number        VARCHAR(100) NOT NULL UNIQUE,
    document_number                 VARCHAR(100) NOT NULL,
    document_title                  VARCHAR(500),
    revision_number                 VARCHAR(50),

    reason                          TEXT,

    status                          VARCHAR(40) NOT NULL,
    status_code                     VARCHAR(40) NOT NULL,

    requested_by_user_id            UUID REFERENCES app_users(id),
    requested_at                    TIMESTAMPTZ,

    approved_by_user_id             UUID REFERENCES app_users(id),
    approved_at                     TIMESTAMPTZ,

    rejected_by_user_id             UUID REFERENCES app_users(id),
    rejected_at                     TIMESTAMPTZ,
    rejection_reason                TEXT,

    generated_by_user_id            UUID REFERENCES app_users(id),
    generated_at                    TIMESTAMPTZ,

    distributed_by_user_id          UUID REFERENCES app_users(id),
    distributed_at                  TIMESTAMPTZ,

    cancelled_by_user_id            UUID REFERENCES app_users(id),
    cancelled_at                    TIMESTAMPTZ,
    cancel_reason                   TEXT,

    recipient_snapshot              JSONB,

    uncontrolled_copy_file_path            VARCHAR(1024),
    uncontrolled_copy_storage_provider     VARCHAR(60),
    uncontrolled_copy_storage_bucket       VARCHAR(255),
    uncontrolled_copy_storage_object_key   VARCHAR(1024),
    uncontrolled_copy_storage_version_id   VARCHAR(255),
    uncontrolled_copy_checksum             VARCHAR(128),

    marking_applied                 BOOLEAN NOT NULL DEFAULT FALSE,
    marking_layout                  JSONB,

    valid_until                     TIMESTAMPTZ,

    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_uncontrolled_copies_document_id ON uncontrolled_copies(document_id);
CREATE INDEX idx_uncontrolled_copies_revision_id ON uncontrolled_copies(revision_id);
CREATE INDEX idx_uncontrolled_copies_status ON uncontrolled_copies(status);
CREATE INDEX idx_uncontrolled_copies_requested_by ON uncontrolled_copies(requested_by_user_id);
