-- Training Management, form templates linked to Document Control (owner decisions 2026-10-28):
-- (1) a form code (APD.0117, FRM.0007 ...) can be linked to the Document Control document that holds the form; when a revision of that document becomes Effective the system takes its source
--     file as a new template version and enables it (no second signature: the approval was given in Document Control), after a check of its structure; when the document is obsoleted the
--     template is disabled. A form code that is not linked keeps the upload and the signed enabling of Training Properties.
-- (2) every form made from a template is recorded with the template that was used, for the activity (or the other object) it was made for, so a form made again later comes out in the same template.
-- Forward-only and idempotent.

CREATE TABLE IF NOT EXISTS training_form_template_links (
    code        VARCHAR(40) PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
    linked_by   UUID NOT NULL REFERENCES app_users(id),
    linked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_training_form_template_links_document UNIQUE (document_id)
);

ALTER TABLE training_form_templates ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE training_form_templates DROP CONSTRAINT IF EXISTS ck_training_form_templates_source;
ALTER TABLE training_form_templates ADD CONSTRAINT ck_training_form_templates_source CHECK (source IN ('MANUAL', 'DOCUMENT_CONTROL'));
ALTER TABLE training_form_templates ADD COLUMN IF NOT EXISTS source_revision_id UUID REFERENCES document_revisions(id);

-- What happened the last time a revision became Effective for a linked form: ENABLED, or why the template was not enabled (the person who administers Training sees it on the screen).
CREATE TABLE IF NOT EXISTS training_form_template_syncs (
    id           UUID PRIMARY KEY,
    code         VARCHAR(40) NOT NULL,
    revision_id  UUID NOT NULL REFERENCES document_revisions(id) ON DELETE RESTRICT,
    outcome      VARCHAR(20) NOT NULL CHECK (outcome IN ('ENABLED', 'REFUSED_STRUCTURE', 'REFUSED_FILE', 'DISABLED', 'NOT_CHECKED')),
    detail       TEXT,
    template_id  UUID REFERENCES training_form_templates(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_training_form_template_syncs_code ON training_form_template_syncs (code, created_at DESC);

CREATE TABLE IF NOT EXISTS training_form_uses (
    id          UUID PRIMARY KEY,
    code        VARCHAR(40) NOT NULL,
    template_id UUID NOT NULL REFERENCES training_form_templates(id) ON DELETE RESTRICT,
    object_type VARCHAR(40) NOT NULL,
    object_id   UUID NOT NULL,
    format      VARCHAR(10),
    used_by     UUID REFERENCES app_users(id),
    used_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_training_form_uses_object ON training_form_uses (code, object_type, object_id, used_at);
