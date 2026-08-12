CREATE SEQUENCE IF NOT EXISTS electronic_signature_sequence START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS electronic_signature_settings (
    id UUID PRIMARY KEY,
    display_style VARCHAR(40) NOT NULL DEFAULT 'DETAILED',
    show_full_name BOOLEAN NOT NULL DEFAULT TRUE,
    show_username BOOLEAN NOT NULL DEFAULT FALSE,
    show_job_title BOOLEAN NOT NULL DEFAULT TRUE,
    show_department BOOLEAN NOT NULL DEFAULT TRUE,
    show_meaning BOOLEAN NOT NULL DEFAULT TRUE,
    show_reason BOOLEAN NOT NULL DEFAULT TRUE,
    show_signed_date_time BOOLEAN NOT NULL DEFAULT TRUE,
    show_timezone BOOLEAN NOT NULL DEFAULT TRUE,
    show_electronically_signed_label BOOLEAN NOT NULL DEFAULT TRUE,
    show_signature_id BOOLEAN NOT NULL DEFAULT TRUE,
    show_status_icon BOOLEAN NOT NULL DEFAULT TRUE,
    show_comment BOOLEAN NOT NULL DEFAULT FALSE,
    require_password_before_signing BOOLEAN NOT NULL DEFAULT TRUE,
    require_reason BOOLEAN NOT NULL DEFAULT TRUE,
    comment_rule VARCHAR(20) NOT NULL DEFAULT 'OPTIONAL',
    allowed_auth_method VARCHAR(40) NOT NULL DEFAULT 'PASSWORD',
    show_audit_trail_summary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS electronic_signature_meanings (
    id UUID PRIMARY KEY,
    code VARCHAR(80) NOT NULL UNIQUE,
    display_name VARCHAR(120) NOT NULL,
    description TEXT,
    requires_reason BOOLEAN NOT NULL DEFAULT TRUE,
    requires_comment BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS electronic_signatures (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE RESTRICT,
    revision_id UUID REFERENCES document_revisions(id) ON DELETE RESTRICT,
    workflow_step_id UUID,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    username VARCHAR(120) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(120),
    department VARCHAR(120),
    meaning VARCHAR(80) NOT NULL,
    reason TEXT,
    comment TEXT,
    signed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone VARCHAR(80) NOT NULL,
    authentication_method VARCHAR(40) NOT NULL,
    signature_id VARCHAR(40) NOT NULL UNIQUE,
    verification_id VARCHAR(80) NOT NULL UNIQUE,
    ip_address VARCHAR(80),
    user_agent VARCHAR(512),
    document_checksum_before_sign VARCHAR(255),
    document_checksum_after_sign VARCHAR(255),
    source_file_version_id VARCHAR(255),
    review_pdf_version_id VARCHAR(255),
    published_pdf_version_id VARCHAR(255),
    status VARCHAR(40) NOT NULL DEFAULT 'SIGNED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT electronic_signatures_status_check CHECK (status IN ('SIGNED', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS idx_electronic_signatures_revision ON electronic_signatures(revision_id, signed_at);
CREATE INDEX IF NOT EXISTS idx_electronic_signatures_document ON electronic_signatures(document_id, signed_at);
CREATE INDEX IF NOT EXISTS idx_electronic_signatures_meaning ON electronic_signatures(meaning);

INSERT INTO electronic_signature_settings (id)
VALUES ('00000000-0000-0000-0000-000000000138')
ON CONFLICT (id) DO NOTHING;

INSERT INTO electronic_signature_meanings (id, code, display_name, description, requires_reason, requires_comment, active, sort_order)
VALUES
    ('00000000-0000-0000-0000-000000138001', 'PREPARED', 'Prepared', 'User confirms the document was prepared.', TRUE, FALSE, TRUE, 10),
    ('00000000-0000-0000-0000-000000138002', 'REVIEWED', 'Reviewed', 'User confirms the document was reviewed.', TRUE, FALSE, TRUE, 20),
    ('00000000-0000-0000-0000-000000138003', 'APPROVED', 'Approved', 'User approves the document for release.', TRUE, FALSE, TRUE, 30),
    ('00000000-0000-0000-0000-000000138004', 'TRAINING_CONFIRMED', 'Training Confirmed', 'User confirms required training was completed.', TRUE, FALSE, TRUE, 40),
    ('00000000-0000-0000-0000-000000138005', 'PUBLISHED', 'Published', 'User confirms the revision was published.', TRUE, FALSE, TRUE, 50),
    ('00000000-0000-0000-0000-000000138006', 'OBSOLETED', 'Obsoleted', 'User confirms the document or revision was obsoleted.', TRUE, FALSE, TRUE, 60),
    ('00000000-0000-0000-0000-000000138007', 'CANCELLED', 'Cancelled', 'User confirms the workflow was cancelled.', TRUE, FALSE, TRUE, 70)
ON CONFLICT (code) DO NOTHING;
