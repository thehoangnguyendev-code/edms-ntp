-- Legacy Import and Training Management (owner decisions D1-D6, DECISION_LOG LEGACY-IMPORT-TRAINING-2026-11-01).
-- 1. A document imported from paper that has a paper Training Number gets a read-only historical activity (kind LEGACY, completed, no session, no assessment) that carries the number.
--    Several revisions of different documents can point to the same activity (one paper number for several SOPs) through document_revisions.training_activity_id.
-- 2. The scan of the paper record and the list of the persons trained belong to the activity: the evidence row names the activity, and the persons are kept in training_legacy_people
--    until the person who verifies signs; only then are the training records written (source LEGACY_IMPORT).

DO $$
DECLARE c TEXT;
BEGIN
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'training_activities'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%INITIAL%PERIODIC%EXTERNAL%' LOOP
        EXECUTE format('ALTER TABLE training_activities DROP CONSTRAINT %I', c);
    END LOOP;
END $$;
ALTER TABLE training_activities ADD CONSTRAINT training_activities_kind_check
    CHECK (kind IN ('INITIAL','PERIODIC','UNPLANNED','RETRAINING','EXTERNAL','LEGACY'));

ALTER TABLE training_legacy_evidence ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES training_activities(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_legacy_evidence_activity ON training_legacy_evidence (activity_id) WHERE activity_id IS NOT NULL AND status IN ('SUBMITTED','VERIFIED');

-- The persons named with the evidence: TRAINEE (was at the paper training; applies to every revision of the activity) and SIGNATORY (author, reviewer or approver of one revision, D-45).
CREATE TABLE IF NOT EXISTS training_legacy_people (
    id              UUID PRIMARY KEY,
    evidence_id     UUID NOT NULL REFERENCES training_legacy_evidence(id) ON DELETE RESTRICT,
    activity_id     UUID NOT NULL REFERENCES training_activities(id) ON DELETE RESTRICT,
    revision_id     UUID REFERENCES document_revisions(id) ON DELETE RESTRICT,
    person_user_id  UUID NOT NULL REFERENCES app_users(id),
    role            VARCHAR(10) NOT NULL CHECK (role IN ('TRAINEE','SIGNATORY')),
    created_by      UUID REFERENCES app_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((role = 'TRAINEE' AND revision_id IS NULL) OR (role = 'SIGNATORY' AND revision_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_legacy_people_trainee ON training_legacy_people (evidence_id, person_user_id) WHERE role = 'TRAINEE';
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_legacy_people_signatory ON training_legacy_people (evidence_id, revision_id, person_user_id) WHERE role = 'SIGNATORY';
CREATE INDEX IF NOT EXISTS ix_training_legacy_people_activity ON training_legacy_people (activity_id);

-- A training record of a person is written once and never changed; the list of persons that waits for the verifier is the same.
CREATE OR REPLACE FUNCTION training_legacy_people_guard() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'The persons named with legacy training evidence cannot be changed or deleted' USING ERRCODE = '0LPTR';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_legacy_people_immutable ON training_legacy_people;
CREATE TRIGGER trg_training_legacy_people_immutable BEFORE UPDATE OR DELETE ON training_legacy_people FOR EACH ROW EXECUTE FUNCTION training_legacy_people_guard();

-- Revisions imported before this change that carry a paper Training Number get the historical activity too (one per number, the first revision leads).
WITH numbered AS (
    SELECT DISTINCT ON (upper(r.training_number)) r.id AS revision_id, r.training_number, r.revision_number, r.training_completion_date, d.id AS document_id, d.document_number,
           d.document_name, d.department_id, r.created_at
      FROM document_revisions r JOIN documents d ON d.id = r.document_id
     WHERE r.training_origin = 'LEGACY_IMPORT' AND r.training_number IS NOT NULL AND r.training_activity_id IS NULL AND d.department_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM training_activities a WHERE upper(a.training_number) = upper(r.training_number))
     ORDER BY upper(r.training_number), r.created_at
), made AS (
    INSERT INTO training_activities(id, training_number, base_number, organizer_department_id, year, serial, kind, status, document_id, revision_id, revision_number, document_number,
                                    document_name, completed_on, remarks)
    SELECT gen_random_uuid(), n.training_number, n.training_number, n.department_id,
           COALESCE(EXTRACT(YEAR FROM n.training_completion_date)::int, EXTRACT(YEAR FROM n.created_at)::int),
           COALESCE(NULLIF(substring(n.training_number from '-([0-9]+)$'), '')::int, 0),
           'LEGACY', 'COMPLETED', n.document_id, n.revision_id, n.revision_number, n.document_number, n.document_name, n.training_completion_date,
           'Paper training imported with the document (Legacy Import)'
      FROM numbered n
    RETURNING id, training_number
)
-- ck_revision_training_mode_consistent: a revision with an activity is not MANUAL; it stays marked LEGACY_IMPORT in training_origin.
UPDATE document_revisions r SET training_activity_id = m.id, training_mode = 'INTEGRATED'
  FROM made m
 WHERE upper(r.training_number) = upper(m.training_number) AND r.training_origin = 'LEGACY_IMPORT' AND r.training_activity_id IS NULL;
