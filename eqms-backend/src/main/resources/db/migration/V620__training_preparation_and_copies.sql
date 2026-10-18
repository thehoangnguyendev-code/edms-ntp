-- Training Management (PLAN-TR-001 17.8): WP-PREP and the first half of WP-DIST.
--
-- Preparation (SOP.0003 5.3.6, TR-35): before a session somebody has to prepare the venue, the equipment, the materials, and tell the trainees and the trainer. Each item of
-- the checklist of a session has a state and, if the organizer wants, a person who has to do it. The checklist warns; it never blocks a session (proposal D-46).
-- Copies (SOP.0003 5.3.2 and 5.3.10, TR-43, proposal D-47): a copy of an approved training requirement or of a job assignment is sent to a department and received there. Each
-- sending and each receipt is a row that cannot be changed.
-- Forward-only and idempotent. Nothing is granted to any role here.

CREATE TABLE IF NOT EXISTS training_session_preparation (
    session_id    UUID NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT,
    item_code     VARCHAR(20) NOT NULL CHECK (item_code IN ('VENUE','EQUIPMENT','MATERIALS','NOTICE')),
    status        VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DONE','NOT_NEEDED')),
    assigned_to   UUID REFERENCES app_users(id),
    note          TEXT,
    updated_by    UUID REFERENCES app_users(id),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, item_code)
);

CREATE TABLE IF NOT EXISTS training_copy_distributions (
    id                   UUID PRIMARY KEY,
    object_type          VARCHAR(30) NOT NULL CHECK (object_type IN ('TRAINING_REQUIREMENT','TRAINING_JOB_ASSIGNMENT')),
    object_id            UUID NOT NULL,
    recipient_department UUID NOT NULL REFERENCES departments(id),
    sent_by              UUID NOT NULL REFERENCES app_users(id),
    sent_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    note                 TEXT,
    received_by          UUID REFERENCES app_users(id),
    received_at          TIMESTAMPTZ,
    CONSTRAINT ck_training_copy_received CHECK ((received_by IS NULL) = (received_at IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_copy_once ON training_copy_distributions (object_type, object_id, recipient_department);
CREATE INDEX IF NOT EXISTS ix_training_copy_recipient ON training_copy_distributions (recipient_department, received_at);

CREATE OR REPLACE FUNCTION training_copy_distribution_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A copy distribution cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.received_at IS NOT NULL THEN RAISE EXCEPTION 'A received copy cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.object_type <> OLD.object_type OR NEW.object_id <> OLD.object_id OR NEW.recipient_department <> OLD.recipient_department OR NEW.sent_by <> OLD.sent_by OR NEW.sent_at <> OLD.sent_at
       OR NEW.note IS DISTINCT FROM OLD.note THEN
        RAISE EXCEPTION 'What was sent cannot be changed' USING ERRCODE = '0LPTR';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_copy_distribution_guard ON training_copy_distributions;
CREATE TRIGGER trg_training_copy_distribution_guard BEFORE UPDATE OR DELETE ON training_copy_distributions FOR EACH ROW EXECUTE FUNCTION training_copy_distribution_guard();
