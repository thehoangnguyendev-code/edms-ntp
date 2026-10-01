-- V513: Form / eForm Phase 2a -- live OnlyOffice Design + Fill sessions.
-- A session is transient working state for either designing fillable fields on a Form's PDF
-- (DESIGN) or an end user filling them in-browser (FILL). Committing a DESIGN session copies its
-- latest saved file into form_settings' fillable-template columns; submitting a FILL session feeds
-- ExecutedRecordService's existing finalizeSubmission() unchanged.

CREATE TABLE eform_edit_sessions (
    id UUID PRIMARY KEY,
    kind VARCHAR(10) NOT NULL, -- DESIGN | FILL
    form_document_id UUID NOT NULL REFERENCES documents(id),
    started_by_user_id UUID NOT NULL REFERENCES app_users(id),
    status VARCHAR(20) NOT NULL, -- ACTIVE | SAVED | SUBMITTED | ABANDONED

    storage_provider VARCHAR(60),
    storage_bucket VARCHAR(255),
    storage_object_key VARCHAR(1024),
    storage_version_id VARCHAR(255),
    checksum VARCHAR(128),

    -- Bumped on every OnlyOffice save callback; feeds the OnlyOffice document key, which must
    -- change whenever the underlying content changes.
    save_version INT NOT NULL DEFAULT 0,

    lock_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eform_edit_sessions_form_document_id ON eform_edit_sessions(form_document_id);
CREATE INDEX idx_eform_edit_sessions_started_by_user_id ON eform_edit_sessions(started_by_user_id);
CREATE INDEX idx_eform_edit_sessions_status ON eform_edit_sessions(status);
