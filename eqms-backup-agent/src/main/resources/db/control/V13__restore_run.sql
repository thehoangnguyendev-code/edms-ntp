-- The restore run (SDS-BR-001 section 11.3, steps R5-R12). One run per approved request. Each step is recorded once, append-only, so
-- the record shows exactly how far a run got and why it stopped. At most one run is open on the whole agent.
CREATE SEQUENCE restore_run_seq;
CREATE TABLE restore_run (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_code        VARCHAR(30)  NOT NULL UNIQUE,
    request_id      VARCHAR(30)  NOT NULL,
    backup_id       VARCHAR(40)  NOT NULL,
    status          VARCHAR(20)  NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    started_by      VARCHAR(120) NOT NULL,
    started_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    failed_step     VARCHAR(20),
    error_code      VARCHAR(60),
    error_detail    TEXT,
    safety_backup_id VARCHAR(40)
);
CREATE UNIQUE INDEX restore_run_one_open ON restore_run ((true)) WHERE status = 'RUNNING';
CREATE INDEX restore_run_request_idx ON restore_run (request_id);

CREATE TABLE restore_run_step (
    id              BIGSERIAL PRIMARY KEY,
    run_id          UUID         NOT NULL REFERENCES restore_run (id),
    step_code       VARCHAR(20)  NOT NULL CHECK (step_code IN ('R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12')),
    status          VARCHAR(20)  NOT NULL CHECK (status IN ('PASSED', 'FAILED')),
    detail_json     JSONB,
    at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (run_id, step_code)
);
CREATE TRIGGER restore_run_step_append_only BEFORE UPDATE OR DELETE ON restore_run_step
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
