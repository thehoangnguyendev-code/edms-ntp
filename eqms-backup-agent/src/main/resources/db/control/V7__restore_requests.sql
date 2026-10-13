-- Restore requests, steps R0-R3 of SDS-BR-001 section 11.3: the request, the impact report, the approval by a different person, and
-- rejection or cancellation. The execution steps R4-R12 are NOT in this migration: a request can be approved but never executed yet.
CREATE SEQUENCE restore_request_seq;
CREATE TABLE restore_request (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id         VARCHAR(30)  NOT NULL UNIQUE,
    run_id             UUID         NOT NULL REFERENCES backup_run (id),
    restore_type       VARCHAR(20)  NOT NULL CHECK (restore_type IN ('R-FULL', 'R-DB', 'R-OBJ', 'R-ONE')),
    target             VARCHAR(20)  NOT NULL CHECK (target IN ('VALIDATION', 'PRODUCTION')),
    status             VARCHAR(20)  NOT NULL CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reason             TEXT         NOT NULL,
    change_control_ref VARCHAR(120),
    requested_by       VARCHAR(120) NOT NULL,
    requested_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    impact_json        JSONB        NOT NULL,
    impact_sha256      CHAR(64)     NOT NULL,
    rehearsal_id       UUID REFERENCES restore_rehearsal (id),
    approved_by        VARCHAR(120),
    approval_signature_ref VARCHAR(120),
    decided_at         TIMESTAMPTZ,
    decision_reason    TEXT,
    -- the person who asked may not approve; the database refuses it even if the service does not
    CONSTRAINT restore_request_two_people CHECK (approved_by IS NULL OR lower(approved_by) <> lower(requested_by))
);
CREATE INDEX restore_request_run_idx ON restore_request (run_id);
CREATE UNIQUE INDEX restore_request_one_open_per_backup ON restore_request (run_id) WHERE status = 'PENDING_APPROVAL';

CREATE TABLE restore_request_event (
    id          BIGSERIAL PRIMARY KEY,
    request_id  UUID         NOT NULL REFERENCES restore_request (id),
    event       VARCHAR(40)  NOT NULL,
    by_user     VARCHAR(120) NOT NULL,
    at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    detail_json JSONB
);
CREATE TRIGGER restore_request_event_append_only BEFORE UPDATE OR DELETE ON restore_request_event
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
