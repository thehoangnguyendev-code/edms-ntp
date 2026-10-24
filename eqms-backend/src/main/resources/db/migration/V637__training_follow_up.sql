-- Follow-up that SOP.0003 asks the people to do and that the system now keeps in view.
--
-- 1. A trainee who does not pass the assessment: the work that depends on the training is suspended until the person has been retrained and has passed, or the head of
--    the unit decides to resume (D-12). It is a flag and a notice, it does not block any other function.
-- 2. The impact of a new or revised document on the training matrix (SOP.0003 5.3.1: the responsible and the relevant departments assess it and update the matrix).
--    One row is one assessment; it is never changed, a new assessment is a new row.

CREATE TABLE IF NOT EXISTS training_work_suspensions (
    id               UUID PRIMARY KEY,
    person_user_id   UUID NOT NULL REFERENCES app_users(id),
    activity_id      UUID NOT NULL REFERENCES training_activities(id),
    participant_id   UUID NOT NULL REFERENCES training_participants(id),
    topic_text       VARCHAR(500),
    percent          NUMERIC(5,2),
    status           VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLEARED')),
    raised_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    raised_by        UUID REFERENCES app_users(id),
    cleared_at       TIMESTAMPTZ,
    cleared_by       UUID REFERENCES app_users(id),
    clear_basis      VARCHAR(20) CHECK (clear_basis IN ('RETRAINED_PASSED','RESUMED_BY_HEAD')),
    clear_reason     TEXT,
    clear_activity_id UUID REFERENCES training_activities(id),
    signature_id     UUID,
    CONSTRAINT ck_training_work_suspension_cleared CHECK ((status = 'OPEN' AND cleared_at IS NULL) OR (status = 'CLEARED' AND cleared_at IS NOT NULL AND clear_basis IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_work_suspension_open ON training_work_suspensions (participant_id) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS ix_training_work_suspension_person ON training_work_suspensions (person_user_id, status);

CREATE TABLE IF NOT EXISTS training_impact_assessments (
    id            UUID PRIMARY KEY,
    activity_id   UUID NOT NULL REFERENCES training_activities(id),
    outcome       VARCHAR(24) NOT NULL CHECK (outcome IN ('MATRIX_UPDATE_NEEDED','MATRIX_ALREADY_COVERS','NO_TRAINING_IMPACT')),
    reason        TEXT NOT NULL,
    positions     JSONB NOT NULL DEFAULT '[]'::jsonb,
    assessed_by   UUID NOT NULL REFERENCES app_users(id),
    assessed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    signature_id  UUID
);
CREATE INDEX IF NOT EXISTS ix_training_impact_activity ON training_impact_assessments (activity_id, assessed_at DESC);

DROP TRIGGER IF EXISTS trg_training_impact_assessments_immutable_row ON training_impact_assessments;
CREATE TRIGGER trg_training_impact_assessments_immutable_row BEFORE DELETE OR UPDATE ON training_impact_assessments
    FOR EACH ROW EXECUTE FUNCTION training_prevent_mutation();
DROP TRIGGER IF EXISTS trg_training_impact_assessments_immutable_stmt ON training_impact_assessments;
CREATE TRIGGER trg_training_impact_assessments_immutable_stmt BEFORE TRUNCATE ON training_impact_assessments
    FOR EACH STATEMENT EXECUTE FUNCTION training_prevent_mutation();

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), v.code, v.name
FROM (VALUES
 ('TRAINING_WORK_RESUMED',    'Work Resumed After Failed Assessment', 'The head of the unit decides that the work suspended after a failed assessment may resume.'),
 ('TRAINING_IMPACT_ASSESSED', 'Training Impact Assessed',             'The person assesses the effect of a new or revised document on the training matrix.')
) AS v(code, name, descr)
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = v.code);
