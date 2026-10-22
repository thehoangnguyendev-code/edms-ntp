-- Training Management, assessment forms: (1) a library of Word templates (for example APD.0009) that Training Administration keeps as the source of a test or a checklist;
-- a template becomes the current one for its code only with an electronic signature of the person who administers Training, and the file never changes afterwards.
-- (2) edit sessions: a Word file of an activity (the exam template or the answer key) opened in OnlyOffice and saved back as a new file of the activity; the file that was
-- there stays on record, marked as removed. Forward-only and idempotent.

CREATE TABLE IF NOT EXISTS training_form_templates (
    id                    UUID PRIMARY KEY,
    code                  VARCHAR(40)  NOT NULL,
    title                 VARCHAR(255) NOT NULL,
    version_label         VARCHAR(40)  NOT NULL,
    original_name         VARCHAR(255) NOT NULL,
    provider              VARCHAR(20)  NOT NULL,
    stored_path           TEXT         NOT NULL,
    content_type          VARCHAR(100) NOT NULL,
    size_bytes            INTEGER      NOT NULL,
    sha256                VARCHAR(64)  NOT NULL,
    remark                TEXT,
    status                VARCHAR(12)  NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CURRENT', 'SUPERSEDED')),
    uploaded_by           UUID         NOT NULL REFERENCES app_users(id),
    uploaded_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    activated_by          UUID REFERENCES app_users(id),
    activated_at          TIMESTAMPTZ,
    activate_signature_id UUID,
    superseded_at         TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_form_template_current ON training_form_templates (code) WHERE status = 'CURRENT';
CREATE INDEX IF NOT EXISTS ix_training_form_templates_code ON training_form_templates (code, uploaded_at DESC);

CREATE OR REPLACE FUNCTION training_form_template_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A training form template cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.stored_path <> OLD.stored_path OR NEW.sha256 <> OLD.sha256 OR NEW.code <> OLD.code OR NEW.version_label <> OLD.version_label OR NEW.uploaded_by <> OLD.uploaded_by THEN
        RAISE EXCEPTION 'A training form template cannot be replaced' USING ERRCODE = '0LPTR';
    END IF;
    IF OLD.status = 'SUPERSEDED' THEN RAISE EXCEPTION 'A superseded training form template cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'CURRENT' AND NEW.status NOT IN ('CURRENT', 'SUPERSEDED') THEN RAISE EXCEPTION 'A current training form template can only be superseded' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_form_template_guard ON training_form_templates;
CREATE TRIGGER trg_training_form_template_guard BEFORE UPDATE OR DELETE ON training_form_templates FOR EACH ROW EXECUTE FUNCTION training_form_template_guard();

CREATE TABLE IF NOT EXISTS training_edit_sessions (
    id             UUID PRIMARY KEY,
    activity_id    UUID NOT NULL REFERENCES training_activities(id) ON DELETE RESTRICT,
    purpose        VARCHAR(20) NOT NULL CHECK (purpose IN ('EXAM', 'ANSWER_KEY')),
    source_kind    VARCHAR(20) NOT NULL CHECK (source_kind IN ('TEMPLATE', 'MATERIAL')),
    source_ref     UUID,
    file_name      VARCHAR(255) NOT NULL,
    provider       VARCHAR(20) NOT NULL,
    stored_path    TEXT NOT NULL,
    sha256         VARCHAR(64) NOT NULL,
    revision_no    INTEGER NOT NULL DEFAULT 1,
    status         VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    opened_by      UUID NOT NULL REFERENCES app_users(id),
    opened_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_saved_at  TIMESTAMPTZ,
    saved_material_id UUID
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_edit_session_open ON training_edit_sessions (activity_id, purpose) WHERE status = 'OPEN';

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), 'TRAINING_FORM_TEMPLATE_ACTIVATED', 'Form Template Activated'
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = 'TRAINING_FORM_TEMPLATE_ACTIVATED');
