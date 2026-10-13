-- Restore execution, step R4 (SDS-BR-001 section 11.3, work package WP3.1 slice 1): an executor schedules an approved request for a
-- maintenance window. Scheduling changes no data: restore_execution is only the plan; the run itself is not built yet.
CREATE TABLE restore_execution (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id   UUID        NOT NULL REFERENCES restore_request (id),
    status       VARCHAR(20) NOT NULL CHECK (status IN ('SCHEDULED')),
    window_start TIMESTAMPTZ NOT NULL,
    scheduled_by VARCHAR(120) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- one open schedule per request
CREATE UNIQUE INDEX restore_execution_one_open_per_request ON restore_execution (request_id) WHERE status = 'SCHEDULED';

CREATE TABLE restore_execution_event (
    id           BIGSERIAL PRIMARY KEY,
    execution_id UUID         NOT NULL REFERENCES restore_execution (id),
    event        VARCHAR(40)  NOT NULL,
    by_user      VARCHAR(120) NOT NULL,
    at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    detail_json  JSONB
);
CREATE TRIGGER restore_execution_event_append_only BEFORE UPDATE OR DELETE ON restore_execution_event
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
