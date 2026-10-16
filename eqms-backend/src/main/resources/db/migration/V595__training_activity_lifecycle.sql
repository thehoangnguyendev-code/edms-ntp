-- Training Management, activity lifecycle (SDS-TR-001 section 4.4 and 4.5): sessions, participants, assessments, confirmations and the personal training record.
-- Rows of assessments, confirmations and records can only be added; a wrong record is voided by a record of its own, never changed.

CREATE TABLE IF NOT EXISTS training_sessions (
    id                    UUID PRIMARY KEY,
    activity_id           UUID NOT NULL REFERENCES training_activities(id) ON DELETE RESTRICT,
    session_no            INTEGER NOT NULL,
    method                VARCHAR(20) NOT NULL CHECK (method IN ('SELF_READING','CLASSROOM','HYBRID','PRACTICAL')),
    assessment_method     VARCHAR(30) NOT NULL CHECK (assessment_method IN ('TEST','CHECKLIST','SELF_READING_CONFIRMATION')),
    trainer_user_id       UUID REFERENCES app_users(id),
    external_trainer_name VARCHAR(255),
    scheduled_on          DATE,
    held_on               DATE,
    venue                 VARCHAR(255),
    status                VARCHAR(12) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','HELD','POSTPONED','CANCELLED')),
    postpone_reason       TEXT,
    version               INTEGER NOT NULL DEFAULT 1,
    created_by            UUID REFERENCES app_users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (activity_id, session_no),
    CHECK (trainer_user_id IS NOT NULL OR external_trainer_name IS NOT NULL OR status = 'PLANNED')
);

CREATE TABLE IF NOT EXISTS training_session_topics (
    id                   UUID PRIMARY KEY,
    session_id           UUID NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT,
    topic_text           VARCHAR(500) NOT NULL,
    document_id          UUID REFERENCES documents(id),
    document_revision_id UUID REFERENCES document_revisions(id),
    document_number      VARCHAR(80),
    revision_number      VARCHAR(40)
);
CREATE INDEX IF NOT EXISTS ix_training_session_topics_session ON training_session_topics (session_id);

CREATE TABLE IF NOT EXISTS training_participants (
    id                UUID PRIMARY KEY,
    activity_id       UUID NOT NULL REFERENCES training_activities(id) ON DELETE RESTRICT,
    session_id        UUID NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT,
    person_user_id    UUID REFERENCES app_users(id),
    external_name     VARCHAR(255),
    external_org      VARCHAR(255),
    employee_code     VARCHAR(80),
    full_name         VARCHAR(255) NOT NULL,
    department        VARCHAR(120),
    position          VARCHAR(120),
    state             VARCHAR(20) NOT NULL DEFAULT 'INVITED' CHECK (state IN ('INVITED','ATTENDED','ONLINE','ABSENT','READ_CONFIRMED')),
    result            VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (result IN ('PENDING','PASSED','FAILED')),
    absence_reason    TEXT,
    added_reason      TEXT,
    sign_mode         VARCHAR(12) NOT NULL DEFAULT 'NONE' CHECK (sign_mode IN ('ESIGN','PAPER_SCAN','ONLINE','NONE')),
    attend_signature_id UUID,
    notified_at       TIMESTAMPTZ,
    version           INTEGER NOT NULL DEFAULT 1,
    created_by        UUID REFERENCES app_users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (person_user_id IS NOT NULL OR external_name IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_participants_session_person ON training_participants (session_id, person_user_id) WHERE person_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_training_participants_person ON training_participants (person_user_id, state, result);
CREATE INDEX IF NOT EXISTS ix_training_participants_activity ON training_participants (activity_id);

CREATE TABLE IF NOT EXISTS training_assessments (
    id                     UUID PRIMARY KEY,
    participant_id         UUID NOT NULL REFERENCES training_participants(id) ON DELETE RESTRICT,
    attempt_no             INTEGER NOT NULL,
    method                 VARCHAR(30) NOT NULL,
    score_obtained         NUMERIC(8,2) NOT NULL CHECK (score_obtained >= 0),
    score_max              NUMERIC(8,2) NOT NULL CHECK (score_max > 0),
    percent                NUMERIC(5,2) NOT NULL,
    pass_percent_snapshot  INTEGER NOT NULL,
    result                 VARCHAR(10) NOT NULL CHECK (result IN ('PASSED','FAILED')),
    assessed_by            UUID NOT NULL REFERENCES app_users(id),
    assessed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    trainee_signature_mode VARCHAR(12) NOT NULL DEFAULT 'NONE',
    remarks                TEXT,
    UNIQUE (participant_id, attempt_no),
    CHECK (score_obtained <= score_max)
);

CREATE TABLE IF NOT EXISTS training_activity_confirmations (
    id           UUID PRIMARY KEY,
    activity_id  UUID NOT NULL REFERENCES training_activities(id) ON DELETE RESTRICT,
    session_id   UUID REFERENCES training_sessions(id),
    kind         VARCHAR(30) NOT NULL CHECK (kind IN ('ATTENDEE_LIST_PREPARED','TRAINER_ATTENDANCE','HEAD_SELF_READING','CONTENT_REVIEWED','CONTENT_APPROVED','QA_COMPLETION')),
    confirmed_by UUID NOT NULL REFERENCES app_users(id),
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    signature_id UUID,
    assignment_id UUID,
    remark       TEXT
);
CREATE INDEX IF NOT EXISTS ix_training_confirmations_activity ON training_activity_confirmations (activity_id, kind);

CREATE SEQUENCE IF NOT EXISTS training_record_no_seq START 1;
CREATE TABLE IF NOT EXISTS training_records (
    id               UUID PRIMARY KEY,
    record_no        BIGINT NOT NULL DEFAULT nextval('training_record_no_seq') UNIQUE,
    person_user_id   UUID NOT NULL REFERENCES app_users(id),
    activity_id      UUID NOT NULL REFERENCES training_activities(id),
    session_id       UUID REFERENCES training_sessions(id),
    participant_id   UUID REFERENCES training_participants(id),
    training_number  VARCHAR(40) NOT NULL,
    topic_text       TEXT NOT NULL,
    document_number  VARCHAR(80),
    document_revision VARCHAR(40),
    completed_on     DATE NOT NULL,
    method           VARCHAR(20) NOT NULL,
    result           VARCHAR(10) NOT NULL CHECK (result IN ('PASSED','READ')),
    source           VARCHAR(20) NOT NULL DEFAULT 'ACTIVITY' CHECK (source IN ('ACTIVITY','LEGACY_IMPORT')),
    employee_code    VARCHAR(80),
    full_name        VARCHAR(255) NOT NULL,
    department       VARCHAR(120),
    position         VARCHAR(120),
    content_sha256   VARCHAR(64) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_training_records_person ON training_records (person_user_id, completed_on DESC);
CREATE INDEX IF NOT EXISTS ix_training_records_document ON training_records (document_number, document_revision);

CREATE TABLE IF NOT EXISTS training_record_voids (
    id                      UUID PRIMARY KEY,
    record_id               UUID NOT NULL UNIQUE REFERENCES training_records(id),
    reason                  TEXT NOT NULL,
    voided_by               UUID NOT NULL REFERENCES app_users(id),
    voided_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    signature_id            UUID,
    replaced_by_record_id   UUID REFERENCES training_records(id)
);

-- Immutability (pattern of V594 / V245)
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['training_assessments','training_activity_confirmations','training_records','training_record_voids'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_immutable_row ON %I', t, t);
        EXECUTE format('CREATE TRIGGER trg_%s_immutable_row BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION training_prevent_mutation()', t, t);
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_immutable_stmt ON %I', t, t);
        EXECUTE format('CREATE TRIGGER trg_%s_immutable_stmt BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION training_prevent_mutation()', t, t);
    END LOOP;
END $$;
