-- Training Management (SOP.0003 5.1, 5.3.11): the events of a person that need a training review that people carry out by hand: a new employee (initial training in three parts), a return after an
-- absence of more than six months, a transfer to another department, a transfer to another site. The software does not decide or detect any of them (it holds no leave data); it keeps the
-- checklist of the SOP, links each item to the training activity that was organised for it, and is closed with an electronic signature of a person who is not the employee.
-- Forward-only and idempotent. Nothing is granted to any role here (the screens use training.job_assignment.view and training.job_assignment.manage).

CREATE SEQUENCE IF NOT EXISTS training_personnel_review_no_seq;

CREATE TABLE IF NOT EXISTS training_personnel_reviews (
    id              UUID PRIMARY KEY,
    review_no       BIGINT NOT NULL DEFAULT nextval('training_personnel_review_no_seq') UNIQUE,
    person_user_id  UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    kind            VARCHAR(20) NOT NULL CHECK (kind IN ('NEW_HIRE','ABSENCE_RETURN','DEPT_TRANSFER','LOCATION_TRANSFER')),
    status          VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','CANCELLED')),
    event_date      DATE NOT NULL,
    absence_from    DATE,
    absence_to      DATE,
    department_from VARCHAR(120),
    department_to   VARCHAR(120),
    note            TEXT,
    created_by      UUID NOT NULL REFERENCES app_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_by       UUID REFERENCES app_users(id),
    closed_at       TIMESTAMPTZ,
    closed_signature_id UUID,
    cancel_reason   TEXT,
    CONSTRAINT ck_training_review_absence CHECK (kind <> 'ABSENCE_RETURN' OR (absence_from IS NOT NULL AND absence_to IS NOT NULL AND absence_to >= absence_from)),
    CONSTRAINT ck_training_review_closed CHECK (status <> 'CLOSED' OR (closed_by IS NOT NULL AND closed_signature_id IS NOT NULL AND closed_by <> person_user_id)),
    CONSTRAINT ck_training_review_cancelled CHECK (status <> 'CANCELLED' OR (cancel_reason IS NOT NULL AND length(btrim(cancel_reason)) > 0))
);
-- One open review of a kind for a person at a time.
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_review_open ON training_personnel_reviews (person_user_id, kind) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS ix_training_review_person ON training_personnel_reviews (person_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS training_personnel_review_items (
    review_id   UUID NOT NULL REFERENCES training_personnel_reviews(id) ON DELETE RESTRICT,
    item_code   VARCHAR(30) NOT NULL,
    status      VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DONE','NOT_NEEDED')),
    activity_id UUID REFERENCES training_activities(id),
    note        TEXT,
    done_by     UUID REFERENCES app_users(id),
    done_at     TIMESTAMPTZ,
    PRIMARY KEY (review_id, item_code)
);

CREATE OR REPLACE FUNCTION training_personnel_review_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A personnel training review cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status <> 'OPEN' THEN RAISE EXCEPTION 'A closed personnel training review cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.person_user_id <> OLD.person_user_id OR NEW.kind <> OLD.kind OR NEW.event_date <> OLD.event_date OR NEW.created_by <> OLD.created_by THEN
        RAISE EXCEPTION 'What the review is about cannot be changed' USING ERRCODE = '0LPTR';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_personnel_review_guard ON training_personnel_reviews;
CREATE TRIGGER trg_training_personnel_review_guard BEFORE UPDATE OR DELETE ON training_personnel_reviews FOR EACH ROW EXECUTE FUNCTION training_personnel_review_guard();

CREATE OR REPLACE FUNCTION training_personnel_review_item_guard() RETURNS trigger AS $$
DECLARE parent_status VARCHAR(10);
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'An item of a personnel training review cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    SELECT status INTO parent_status FROM training_personnel_reviews WHERE id = OLD.review_id;
    IF parent_status <> 'OPEN' THEN RAISE EXCEPTION 'The items of a closed personnel training review cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_personnel_review_item_guard ON training_personnel_review_items;
CREATE TRIGGER trg_training_personnel_review_item_guard BEFORE UPDATE OR DELETE ON training_personnel_review_items FOR EACH ROW EXECUTE FUNCTION training_personnel_review_item_guard();

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), 'TRAINING_REVIEW_CLOSED', 'Personnel Training Review Closed'
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = 'TRAINING_REVIEW_CLOSED');
