-- Training Assessments (APD.0009): the tests and checklists that are designed once, approved with a signature, and chosen by a training activity.
--   Case 1, a question test: single or multiple choice, true or false, and essay questions (an essay is marked by hand on the paper).
--   Case 2, a checklist: each line is ticked "Correct" or "Incorrect"; the key says which one is expected.
-- A version that is approved never changes; a change is a new version. An activity that chooses one keeps its own frozen copy (the snapshot), so a later version never alters a test already printed.
CREATE SEQUENCE IF NOT EXISTS training_assessment_code_seq START 1;

CREATE TABLE IF NOT EXISTS training_assessment_defs (
    id                    UUID PRIMARY KEY,
    code                  VARCHAR(40)  NOT NULL,
    version_no            INTEGER      NOT NULL DEFAULT 1,
    title                 VARCHAR(255) NOT NULL,
    kind                  VARCHAR(12)  NOT NULL,
    document_number       VARCHAR(80),
    remark                TEXT,
    status                VARCHAR(12)  NOT NULL DEFAULT 'DRAFT',
    version               INTEGER      NOT NULL DEFAULT 0,
    created_by            UUID         NOT NULL REFERENCES app_users(id),
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by            UUID         NOT NULL REFERENCES app_users(id),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    approved_by           UUID REFERENCES app_users(id),
    approved_at           TIMESTAMPTZ,
    approval_signature_id UUID,
    CONSTRAINT ck_training_assessment_kind CHECK (kind IN ('QUESTIONS', 'CHECKLIST')),
    CONSTRAINT ck_training_assessment_status CHECK (status IN ('DRAFT', 'APPROVED', 'SUPERSEDED')),
    CONSTRAINT ux_training_assessment_code_version UNIQUE (code, version_no)
);
-- one draft at a time for a code
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_assessment_one_draft ON training_assessment_defs (code) WHERE status = 'DRAFT';
CREATE INDEX IF NOT EXISTS ix_training_assessment_status ON training_assessment_defs (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS training_assessment_def_items (
    id           UUID PRIMARY KEY,
    def_id       UUID          NOT NULL REFERENCES training_assessment_defs(id) ON DELETE CASCADE,
    item_no      INTEGER       NOT NULL,
    kind         VARCHAR(12)   NOT NULL,
    prompt       TEXT          NOT NULL,
    options      JSONB         NOT NULL DEFAULT '[]'::jsonb,
    correct      JSONB         NOT NULL DEFAULT '[]'::jsonb,
    points       NUMERIC(6, 2) NOT NULL DEFAULT 1,
    model_answer TEXT,
    CONSTRAINT ck_training_assessment_item_kind CHECK (kind IN ('SINGLE', 'MULTI', 'TRUE_FALSE', 'ESSAY', 'CHECK')),
    CONSTRAINT ck_training_assessment_item_points CHECK (points > 0),
    CONSTRAINT ux_training_assessment_item UNIQUE (def_id, item_no)
);

ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS assessment_def_id UUID REFERENCES training_assessment_defs(id);
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS assessment_def_code VARCHAR(40);
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS assessment_def_version INTEGER;
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS assessment_title VARCHAR(255);
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS assessment_kind VARCHAR(12);
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS assessment_max_score NUMERIC(8, 2);
-- The frozen copy holds the answer key, so it lives in a table of its own: no query of the activity carries it by accident.
CREATE TABLE IF NOT EXISTS training_activity_assessments (
    activity_id         UUID PRIMARY KEY REFERENCES training_activities(id) ON DELETE CASCADE,
    assessment_def_id   UUID NOT NULL REFERENCES training_assessment_defs(id),
    snapshot            JSONB NOT NULL,
    snapshot_sha256     VARCHAR(64) NOT NULL,
    chosen_by           UUID NOT NULL REFERENCES app_users(id),
    chosen_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), v.code, v.name, 'Training Management', 'training', 'training_assessment', v.description, v.display_order, TRUE
FROM (VALUES
    ('training.assessment.design',  'Design Training Assessments',  'Write and change the tests and checklists of the Training Assessments library (questions, answers, the key). Does not approve them.', 246),
    ('training.assessment.approve', 'Approve Training Assessments', 'Approve a test or checklist of the Training Assessments library with an electronic signature, so that training activities can use it. Not the person who last changed it.', 247)
) AS v(code, name, description, display_order)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), v.code, v.name
FROM (VALUES ('TRAINING_ASSESSMENT_APPROVED', 'Training Assessment Approved')) AS v(code, name)
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = v.code);
