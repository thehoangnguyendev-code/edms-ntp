-- V518: Form / eForm Phase 2a -- sequential multi-signer Fill. A Form can require several Roles to
-- sign in order (e.g. "Nguoi_lap" fills first, then "Truong_phong", then "Quality_Manager"); each
-- role's work must build on the PREVIOUS role's saved file, not restart from the pristine fillable
-- template, and the Form only becomes a submitted Executed Record once the LAST role in sequence
-- signs off. eform_fill_runs is the one accumulating "in-progress Fill" per Form (one IN_PROGRESS
-- run at a time) that each role's FILL session chains onto -- see EformEditSessionService.

CREATE TABLE eform_fill_runs (
    id UUID PRIMARY KEY,
    form_document_id UUID NOT NULL REFERENCES documents(id),
    status VARCHAR(20) NOT NULL, -- IN_PROGRESS | COMPLETED | ABANDONED
    current_sequence INT NOT NULL,
    file_name VARCHAR(255),
    storage_provider VARCHAR(60),
    storage_bucket VARCHAR(255),
    storage_object_key VARCHAR(1024),
    storage_version_id VARCHAR(255),
    checksum VARCHAR(128),
    started_by_user_id UUID NOT NULL REFERENCES app_users(id),
    lock_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eform_fill_runs_document_status ON eform_fill_runs(form_document_id, status);

-- Which position in the signing order each role occupies -- the next role to act is the smallest
-- sequence greater than the run's current_sequence once the current one signs off.
ALTER TABLE form_role_assignments ADD COLUMN sequence INT NOT NULL DEFAULT 1;

-- Which accumulating Fill run a FILL session is a step of -- null for a Form with no roles
-- configured (back-compat: a single session still fills everything in one go).
ALTER TABLE eform_edit_sessions ADD COLUMN fill_run_id UUID REFERENCES eform_fill_runs(id);
