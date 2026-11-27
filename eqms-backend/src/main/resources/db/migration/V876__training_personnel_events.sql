-- DEC-TRAINING-2026-11-27-01 (H): the system recognises the events after which SOP.0003 asks for training (a new employee, a return after a long absence, a move to another
-- department, a change of position) and alerts the people who start the work. The ledger holds one row for each event; a scan fills it from the user records and the audit trail.
CREATE TABLE IF NOT EXISTS training_personnel_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_user_id  uuid NOT NULL REFERENCES app_users(id),
    kind            varchar(20) NOT NULL CHECK (kind IN ('NEW_HIRE', 'ABSENCE_RETURN', 'DEPT_TRANSFER', 'POSITION_CHANGE', 'START_DATE_MISSING')),
    event_date      date NOT NULL,
    absence_from    date,
    absence_to      date,
    department_from varchar(120),
    department_to   varchar(120),
    position_from   varchar(255),
    position_to     varchar(255),
    source          varchar(40) NOT NULL,
    source_key      varchar(200) NOT NULL,
    status          varchar(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'HANDLED', 'DISMISSED')),
    review_id       uuid REFERENCES training_personnel_reviews(id),
    closed_reason   varchar(300),
    closed_by       uuid REFERENCES app_users(id),
    closed_at       timestamptz,
    signature_id    uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_reminded_at timestamptz,
    UNIQUE (kind, source_key)
);
CREATE INDEX IF NOT EXISTS ix_training_personnel_events_open ON training_personnel_events (status, kind);
CREATE INDEX IF NOT EXISTS ix_training_personnel_events_person ON training_personnel_events (person_user_id);

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), 'TRAINING_PERSONNEL_EVENT_DISMISSED', 'Training Alert Dismissed'
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = 'TRAINING_PERSONNEL_EVENT_DISMISSED');

-- D3 (SOP.0003 5.3.1): the month in which the heads of department are reminded to review the matrix before the annual training requirement is prepared
ALTER TABLE training_settings ADD COLUMN IF NOT EXISTS matrix_review_reminder_month int NOT NULL DEFAULT 10 CHECK (matrix_review_reminder_month BETWEEN 1 AND 12);
