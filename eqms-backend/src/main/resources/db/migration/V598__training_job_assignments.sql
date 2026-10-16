-- Training Management, job assignments (APD.0024, SDS-TR-001 section 3.4 and 4.5): a person is given a position after the training the matrix requires for it,
-- or by an exception that someone designated approves. Two signatures: the person who assigns and the employee who accepts. Forward-only and idempotent.

CREATE TABLE IF NOT EXISTS training_job_assignments (
    id                           UUID PRIMARY KEY,
    person_user_id               UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    issue_no                     INTEGER NOT NULL,
    case_type                    VARCHAR(10) NOT NULL CHECK (case_type IN ('INITIAL','CHANGE')),
    department_id                UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    position_id                  UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    direct_superior_title        VARCHAR(255),
    subordinate_titles           VARCHAR(500),
    substitute_title             VARCHAR(255),
    previous_department_id       UUID REFERENCES departments(id),
    previous_position_id         UUID REFERENCES positions(id),
    change_reason                TEXT,
    jurisdiction                 TEXT,
    matrix_version_id            UUID REFERENCES training_matrix_versions(id),
    matrix_completion_snapshot   JSONB,
    exception_reason             TEXT,
    exception_approved_by        UUID REFERENCES app_users(id),
    exception_signature_id       UUID,
    status                       VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_RECEIVER','EFFECTIVE','SUPERSEDED','CANCELLED')),
    assignor_user_id             UUID REFERENCES app_users(id),
    assignor_title               VARCHAR(255),
    assignor_signature_id        UUID,
    receiver_signature_id        UUID,
    effective_at                 TIMESTAMPTZ,
    cancel_reason                TEXT,
    version                      INTEGER NOT NULL DEFAULT 1,
    created_by                   UUID REFERENCES app_users(id),
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (person_user_id, issue_no),
    CHECK (case_type <> 'CHANGE' OR previous_position_id IS NOT NULL OR change_reason IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_job_effective ON training_job_assignments (person_user_id) WHERE status = 'EFFECTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_job_open ON training_job_assignments (person_user_id) WHERE status IN ('DRAFT','PENDING_RECEIVER');

CREATE TABLE IF NOT EXISTS training_job_assignment_duties (
    assignment_id  UUID NOT NULL REFERENCES training_job_assignments(id) ON DELETE RESTRICT,
    sort_order     INTEGER NOT NULL,
    responsibility VARCHAR(500) NOT NULL,
    description    TEXT,
    PRIMARY KEY (assignment_id, sort_order)
);

-- An assignment that was signed by both people (effective, superseded) and its duties cannot be changed; the only later change is to superseded.
CREATE OR REPLACE FUNCTION training_job_assignment_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('PENDING_RECEIVER','EFFECTIVE','SUPERSEDED') THEN RAISE EXCEPTION 'A signed job assignment cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
        RETURN OLD;
    END IF;
    IF OLD.status = 'SUPERSEDED' THEN RAISE EXCEPTION 'A superseded job assignment cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'EFFECTIVE' AND NEW.status <> 'SUPERSEDED' THEN RAISE EXCEPTION 'An effective job assignment cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_job_assignment_guard ON training_job_assignments;
CREATE TRIGGER trg_training_job_assignment_guard BEFORE UPDATE OR DELETE ON training_job_assignments FOR EACH ROW EXECUTE FUNCTION training_job_assignment_guard();

CREATE OR REPLACE FUNCTION training_job_duty_guard() RETURNS trigger AS $$
DECLARE s VARCHAR(20);
BEGIN
    SELECT status INTO s FROM training_job_assignments WHERE id = COALESCE(OLD.assignment_id, NEW.assignment_id);
    IF s IN ('PENDING_RECEIVER','EFFECTIVE','SUPERSEDED') THEN RAISE EXCEPTION 'The duties of a signed job assignment cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_job_duty_guard ON training_job_assignment_duties;
CREATE TRIGGER trg_training_job_duty_guard BEFORE UPDATE OR DELETE ON training_job_assignment_duties FOR EACH ROW EXECUTE FUNCTION training_job_duty_guard();
