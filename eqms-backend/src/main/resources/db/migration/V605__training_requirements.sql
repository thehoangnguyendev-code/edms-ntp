-- Training Management, the training requirement (APD.0118, SDS-TR-001 section 4.3): the plan of the trainings of a year (or of a review of SOPs), prepared by one person,
-- reviewed by a second and approved by a third, each with a signature. Once approved the plan cannot be changed; only the columns that record what was done
-- (the activity, the postponement, the QA comment) can be written after that. Forward-only and idempotent.

CREATE TABLE IF NOT EXISTS training_requirements (
    id                      UUID PRIMARY KEY,
    request_no              VARCHAR(40) NOT NULL UNIQUE,
    year                    INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    kind                    VARCHAR(14) NOT NULL CHECK (kind IN ('ANNUAL','SOP_PERIODIC')),
    department_id           UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    status                  VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_REVIEW','PENDING_APPROVAL','APPROVED')),
    due_by                  DATE NOT NULL,
    prepared_by             UUID REFERENCES app_users(id),
    prepared_signature_id   UUID,
    prepared_at             TIMESTAMPTZ,
    reviewed_by             UUID REFERENCES app_users(id),
    reviewed_signature_id   UUID,
    reviewed_at             TIMESTAMPTZ,
    approved_by             UUID REFERENCES app_users(id),
    approved_signature_id   UUID,
    approved_at             TIMESTAMPTZ,
    reject_reason           TEXT,
    version                 INTEGER NOT NULL DEFAULT 1,
    created_by              UUID REFERENCES app_users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_training_requirements_year ON training_requirements (year, department_id);

CREATE TABLE IF NOT EXISTS training_requirement_lines (
    id               UUID PRIMARY KEY,
    requirement_id   UUID NOT NULL REFERENCES training_requirements(id) ON DELETE RESTRICT,
    line_no          INTEGER NOT NULL,
    planned_month    DATE NOT NULL CHECK (EXTRACT(DAY FROM planned_month) = 1),
    topic_id         UUID REFERENCES training_topics(id),
    document_id      UUID REFERENCES documents(id),
    activity_id      UUID REFERENCES training_activities(id),
    postponed_from   DATE,
    postpone_reason  TEXT,
    qa_comment       TEXT,
    qa_signed_by     UUID REFERENCES app_users(id),
    qa_signature_id  UUID,
    qa_signed_at     TIMESTAMPTZ,
    UNIQUE (requirement_id, line_no),
    CHECK ((topic_id IS NULL) <> (document_id IS NULL))
);

CREATE OR REPLACE FUNCTION training_requirement_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'A requirement that was submitted cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
        RETURN OLD;
    END IF;
    IF OLD.status = 'APPROVED' THEN RAISE EXCEPTION 'An approved training requirement cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_requirement_guard ON training_requirements;
CREATE TRIGGER trg_training_requirement_guard BEFORE UPDATE OR DELETE ON training_requirements FOR EACH ROW EXECUTE FUNCTION training_requirement_guard();

-- The plan of a line (month, topic, document, number) is frozen with the requirement; what was done about it can still be recorded.
CREATE OR REPLACE FUNCTION training_requirement_line_guard() RETURNS trigger AS $$
DECLARE s VARCHAR(16);
BEGIN
    SELECT status INTO s FROM training_requirements WHERE id = COALESCE(OLD.requirement_id, NEW.requirement_id);
    IF TG_OP = 'DELETE' THEN
        IF s <> 'DRAFT' THEN RAISE EXCEPTION 'The lines of a submitted requirement cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
        RETURN OLD;
    END IF;
    IF s <> 'DRAFT' THEN
        IF s <> 'APPROVED' THEN RAISE EXCEPTION 'The lines of a submitted requirement cannot be changed' USING ERRCODE = '0LPTR'; END IF;
        IF NEW.requirement_id <> OLD.requirement_id OR NEW.line_no <> OLD.line_no OR NEW.topic_id IS DISTINCT FROM OLD.topic_id OR NEW.document_id IS DISTINCT FROM OLD.document_id THEN
            RAISE EXCEPTION 'The plan of an approved requirement cannot be changed' USING ERRCODE = '0LPTR';
        END IF;
        IF NEW.planned_month <> OLD.planned_month AND NEW.postponed_from IS NULL THEN
            RAISE EXCEPTION 'A month of an approved requirement can only be postponed, with the old month kept' USING ERRCODE = '0LPTR';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_requirement_line_guard ON training_requirement_lines;
CREATE TRIGGER trg_training_requirement_line_guard BEFORE UPDATE OR DELETE ON training_requirement_lines FOR EACH ROW EXECUTE FUNCTION training_requirement_line_guard();
