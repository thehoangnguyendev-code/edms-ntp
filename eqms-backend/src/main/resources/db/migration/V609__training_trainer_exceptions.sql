-- Training Management, trainers who are not yet qualified (SOP.0003 TR-19, SDS-TR-001 section 8.3, decision D-10): a session may go ahead with such a trainer only after a person
-- designated for the step approves an exception with a signature. One exception for each session. Forward-only and idempotent.

CREATE TABLE IF NOT EXISTS training_trainer_exceptions (
    id              UUID PRIMARY KEY,
    activity_id     UUID NOT NULL REFERENCES training_activities(id) ON DELETE RESTRICT,
    session_id      UUID NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT,
    trainer_user_id UUID NOT NULL REFERENCES app_users(id),
    reason          TEXT NOT NULL,
    status          VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    requested_by    UUID NOT NULL REFERENCES app_users(id),
    approved_by     UUID REFERENCES app_users(id),
    signature_id    UUID,
    decided_at      TIMESTAMPTZ,
    reject_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One exception at a time for a session (a rejected one stays on record and a new request can follow).
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_trainer_exception_open ON training_trainer_exceptions (session_id) WHERE status IN ('PENDING','APPROVED');

CREATE OR REPLACE FUNCTION training_trainer_exception_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A trainer exception cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status <> 'PENDING' THEN RAISE EXCEPTION 'A decided trainer exception cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_trainer_exception_guard ON training_trainer_exceptions;
CREATE TRIGGER trg_training_trainer_exception_guard BEFORE UPDATE OR DELETE ON training_trainer_exceptions FOR EACH ROW EXECUTE FUNCTION training_trainer_exception_guard();
