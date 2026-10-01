-- V510: Form/eForm Executed Records (Phase 1 -- see plan "Form / eForm Executed Records").
-- A Form document can opt into producing Executed Records (a filled eForm submission or a
-- scanned paper copy) tracked against ITSELF -- never spawning a new Document Number, unlike the
-- prior ad-hoc workaround of uploading a scan as a brand-new Document with type RECORD.

-- One row per Document that has opted in. Decided per-Form on the Document's own Workflow panel
-- (Author/DCO), not gated by Document Type -- mirrors how requiresTraining is a per-Document
-- decision made at creation, not a Document Type flag.
CREATE TABLE form_settings (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL UNIQUE REFERENCES documents(id),
    allow_eform BOOLEAN NOT NULL DEFAULT FALSE,
    allow_paper BOOLEAN NOT NULL DEFAULT FALSE,
    require_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approver_user_id UUID REFERENCES app_users(id),
    -- The Form-Creator-augmented fillable file, kept SEPARATE from the canonical Effective
    -- published PDF -- designing eForm fields never mutates the official document content.
    fillable_template_storage_provider VARCHAR(60),
    fillable_template_storage_bucket VARCHAR(255),
    fillable_template_storage_object_key VARCHAR(1024),
    fillable_template_storage_version_id VARCHAR(255),
    fillable_template_checksum VARCHAR(128),
    fillable_template_revision_id UUID REFERENCES document_revisions(id),
    lock_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE executed_records (
    id UUID PRIMARY KEY,
    record_number VARCHAR(100) NOT NULL UNIQUE,
    form_document_id UUID NOT NULL REFERENCES documents(id),
    form_revision_id UUID NOT NULL REFERENCES document_revisions(id),
    capture_method VARCHAR(20) NOT NULL, -- EFORM | PAPER_SCAN
    status VARCHAR(20) NOT NULL, -- DRAFT | SUBMITTED | PENDING_APPROVAL | EXECUTED | REJECTED

    filled_by_user_id UUID REFERENCES app_users(id),
    filled_at TIMESTAMPTZ,

    -- Paper path only: the Controlled Copy that was printed, filled by hand and scanned back.
    source_controlled_copy_id UUID REFERENCES controlled_copies(id),

    storage_provider VARCHAR(60),
    storage_bucket VARCHAR(255),
    storage_object_key VARCHAR(1024),
    storage_version_id VARCHAR(255),
    checksum VARCHAR(128),

    submit_signature_id UUID,
    approved_by_user_id UUID REFERENCES app_users(id),
    approve_signature_id UUID,
    rejected_by_user_id UUID REFERENCES app_users(id),
    rejected_at TIMESTAMPTZ,
    rejected_reason TEXT,

    lock_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_executed_records_form_document_id ON executed_records(form_document_id);
CREATE INDEX idx_executed_records_status ON executed_records(status);
CREATE INDEX idx_executed_records_capture_method ON executed_records(capture_method);
CREATE INDEX idx_executed_records_filled_by_user_id ON executed_records(filled_by_user_id);
CREATE INDEX idx_executed_records_source_controlled_copy_id ON executed_records(source_controlled_copy_id);
