-- Training Management, paper first (PLAN-TR-001 17.7, decision proposal D-51): the attendance and the scores written on paper are typed into the system as a transcription. The scan of
-- the paper is mandatory, a second person checks the typed lines against the scan and signs, and only then are the lines applied as attendance and assessment. A transcription
-- made later than one working day after the session needs a reason. Forward-only and idempotent. Nothing is granted to any role here.

CREATE TABLE IF NOT EXISTS training_transcriptions (
    id              UUID PRIMARY KEY,
    activity_id     UUID NOT NULL REFERENCES training_activities(id) ON DELETE RESTRICT,
    session_id      UUID NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT,
    evidence_id     UUID NOT NULL REFERENCES training_paper_evidence(id) ON DELETE RESTRICT,
    status          VARCHAR(10) NOT NULL DEFAULT 'ENTERED' CHECK (status IN ('ENTERED','VERIFIED','REJECTED')),
    idempotency_key VARCHAR(80) NOT NULL,
    late_reason     TEXT,
    entered_by      UUID NOT NULL REFERENCES app_users(id),
    entered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_by     UUID REFERENCES app_users(id),
    verified_at     TIMESTAMPTZ,
    signature_id    UUID,
    reject_reason   TEXT,
    CONSTRAINT ux_training_transcription_key UNIQUE (session_id, idempotency_key),
    CONSTRAINT ck_training_transcription_decided CHECK (
        (status = 'ENTERED' AND verified_by IS NULL) OR
        (status = 'VERIFIED' AND verified_by IS NOT NULL AND signature_id IS NOT NULL AND verified_by <> entered_by) OR
        (status = 'REJECTED' AND verified_by IS NOT NULL AND reject_reason IS NOT NULL AND verified_by <> entered_by))
);
-- One transcription waits for checking at a time for a session; a rejected one stays on record and a new one can follow.
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_transcription_open ON training_transcriptions (session_id) WHERE status = 'ENTERED';
CREATE INDEX IF NOT EXISTS ix_training_transcription_activity ON training_transcriptions (activity_id);

CREATE TABLE IF NOT EXISTS training_transcription_lines (
    transcription_id UUID NOT NULL REFERENCES training_transcriptions(id) ON DELETE RESTRICT,
    participant_id   UUID NOT NULL REFERENCES training_participants(id) ON DELETE RESTRICT,
    state            VARCHAR(10) NOT NULL CHECK (state IN ('ATTENDED','ABSENT')),
    absence_reason   TEXT,
    score_obtained   NUMERIC(7,2) CHECK (score_obtained IS NULL OR score_obtained >= 0),
    score_max        NUMERIC(7,2) CHECK (score_max IS NULL OR score_max > 0),
    remarks          TEXT,
    PRIMARY KEY (transcription_id, participant_id),
    CHECK (state = 'ATTENDED' OR (score_obtained IS NULL AND score_max IS NULL)),
    CHECK (state = 'ABSENT' OR absence_reason IS NULL),
    CHECK (state = 'ATTENDED' OR (absence_reason IS NOT NULL AND length(btrim(absence_reason)) > 0))
);

CREATE OR REPLACE FUNCTION training_transcription_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'A transcription cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status <> 'ENTERED' THEN RAISE EXCEPTION 'A decided transcription cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF NEW.activity_id <> OLD.activity_id OR NEW.session_id <> OLD.session_id OR NEW.evidence_id <> OLD.evidence_id OR NEW.entered_by <> OLD.entered_by OR NEW.entered_at <> OLD.entered_at
       OR NEW.idempotency_key <> OLD.idempotency_key OR NEW.late_reason IS DISTINCT FROM OLD.late_reason THEN
        RAISE EXCEPTION 'What was typed cannot be changed' USING ERRCODE = '0LPTR';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_transcription_guard ON training_transcriptions;
CREATE TRIGGER trg_training_transcription_guard BEFORE UPDATE OR DELETE ON training_transcriptions FOR EACH ROW EXECUTE FUNCTION training_transcription_guard();

CREATE OR REPLACE FUNCTION training_transcription_line_guard() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'A transcription line cannot be changed or deleted' USING ERRCODE = '0LPTR';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_transcription_line_guard ON training_transcription_lines;
CREATE TRIGGER trg_training_transcription_line_guard BEFORE UPDATE OR DELETE ON training_transcription_lines FOR EACH ROW EXECUTE FUNCTION training_transcription_line_guard();

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), v.code, v.name, 'Training Management', 'training', 'training_activity', v.descr, v.ord, TRUE
FROM (VALUES
 ('training.paper.transcribe', 'Transcribe Training Paper Records', 'Type the attendance and scores written on paper into the system, with the scan attached.', 241),
 ('training.paper.verify',     'Verify Training Transcriptions',    'Check a transcription against the scan and sign it. Not the person who typed it.', 242)
) AS v(code, name, descr, ord)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), 'TRAINING_TRANSCRIPTION_VERIFIED', 'Transcription Verified'
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = 'TRAINING_TRANSCRIPTION_VERIFIED');
