-- Training Management: the test of APD.0009 taken in the system (SOP.0003 5.1.2 and 5.3.7). The trainer writes the questions with the training content; they are reviewed and approved with it and can no
-- longer change afterwards. A trainee the trainer has marked present opens the test, answers, and signs; the system grades it against the key kept on the server and writes the result through the
-- same assessment table as a result typed by a person (pass mark of the settings). A new attempt after a time-out needs the trainer to release it with a reason.
-- Forward-only and idempotent. Nothing is granted to any role here.

ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS exam_minutes INTEGER;
ALTER TABLE training_activities DROP CONSTRAINT IF EXISTS ck_training_activities_exam_minutes;
ALTER TABLE training_activities ADD CONSTRAINT ck_training_activities_exam_minutes CHECK (exam_minutes IS NULL OR exam_minutes BETWEEN 1 AND 480);

CREATE TABLE IF NOT EXISTS training_exam_questions (
    id          UUID PRIMARY KEY,
    activity_id UUID NOT NULL REFERENCES training_activities(id) ON DELETE RESTRICT,
    q_no        INTEGER NOT NULL CHECK (q_no >= 1),
    kind        VARCHAR(12) NOT NULL CHECK (kind IN ('SINGLE','MULTI','TRUE_FALSE')),
    prompt      TEXT NOT NULL CHECK (length(btrim(prompt)) > 0),
    options     JSONB NOT NULL,
    correct     JSONB NOT NULL,
    points      NUMERIC(5,2) NOT NULL DEFAULT 1 CHECK (points > 0 AND points <= 100),
    created_by  UUID NOT NULL REFERENCES app_users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (activity_id, q_no)
);

-- The questions can be written and rewritten only while the training has not been approved to go ahead.
CREATE OR REPLACE FUNCTION training_exam_question_guard() RETURNS trigger AS $$
DECLARE s VARCHAR(30); aid UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN aid := OLD.activity_id; ELSE aid := NEW.activity_id; END IF;
    SELECT status INTO s FROM training_activities WHERE id = aid;
    IF s NOT IN ('PLANNED','RESERVED') THEN RAISE EXCEPTION 'The questions of an approved training cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_exam_question_guard ON training_exam_questions;
CREATE TRIGGER trg_training_exam_question_guard BEFORE INSERT OR UPDATE OR DELETE ON training_exam_questions FOR EACH ROW EXECUTE FUNCTION training_exam_question_guard();

CREATE TABLE IF NOT EXISTS training_exam_attempts (
    id             UUID PRIMARY KEY,
    participant_id UUID NOT NULL REFERENCES training_participants(id) ON DELETE RESTRICT,
    attempt_no     INTEGER NOT NULL CHECK (attempt_no >= 1),
    status         VARCHAR(12) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS','SUBMITTED','EXPIRED')),
    started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at         TIMESTAMPTZ,
    submitted_at   TIMESTAMPTZ,
    answers        JSONB,
    score_obtained NUMERIC(8,2),
    score_max      NUMERIC(8,2),
    percent        NUMERIC(5,2),
    assessment_id  UUID REFERENCES training_assessments(id),
    signature_id   UUID,
    UNIQUE (participant_id, attempt_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_exam_attempt_open ON training_exam_attempts (participant_id) WHERE status = 'IN_PROGRESS';

CREATE OR REPLACE FUNCTION training_exam_attempt_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A test attempt cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'A finished test attempt cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_exam_attempt_guard ON training_exam_attempts;
CREATE TRIGGER trg_training_exam_attempt_guard BEFORE UPDATE OR DELETE ON training_exam_attempts FOR EACH ROW EXECUTE FUNCTION training_exam_attempt_guard();

CREATE TABLE IF NOT EXISTS training_exam_resets (
    id             UUID PRIMARY KEY,
    participant_id UUID NOT NULL REFERENCES training_participants(id) ON DELETE RESTRICT,
    reason         TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
    reset_by       UUID NOT NULL REFERENCES app_users(id),
    reset_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION training_exam_reset_guard() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'The release of a test attempt is a record and cannot be changed or deleted' USING ERRCODE = '0LPTR';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_exam_reset_guard ON training_exam_resets;
CREATE TRIGGER trg_training_exam_reset_guard BEFORE UPDATE OR DELETE ON training_exam_resets FOR EACH ROW EXECUTE FUNCTION training_exam_reset_guard();
