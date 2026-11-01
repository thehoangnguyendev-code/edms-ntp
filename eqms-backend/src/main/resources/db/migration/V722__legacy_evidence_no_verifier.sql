-- Legacy training evidence has no second person who verifies it any more (owner decision, 2026-11-01). The person who imports signs the import (its e-signature, with the justification), or,
-- when the evidence is attached later from the queue, signs that. The evidence is FILED at once, is read-only, and the training records of the persons named with it are written at once.
-- Evidence that waits for a verifier (SUBMITTED) becomes FILED, its records are written, and the pending assignments to verify are cancelled. Evidence that a person verified (VERIFIED) and
-- the rejected (REJECTED) stay as they were: they are history.

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), 'TRAINING_LEGACY_FILED', 'Legacy Training Evidence Filed'
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings WHERE code = 'TRAINING_LEGACY_FILED');

DO $$
DECLARE c TEXT;
BEGIN
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'training_legacy_evidence'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%SUBMITTED%VERIFIED%REJECTED%' LOOP
        EXECUTE format('ALTER TABLE training_legacy_evidence DROP CONSTRAINT %I', c);
    END LOOP;
END $$;
ALTER TABLE training_legacy_evidence ADD CONSTRAINT ck_training_legacy_evidence_status CHECK (status IN ('SUBMITTED', 'VERIFIED', 'REJECTED', 'FILED'));
ALTER TABLE training_legacy_evidence ALTER COLUMN status SET DEFAULT 'FILED';

DROP INDEX IF EXISTS ux_training_legacy_evidence_open;
CREATE UNIQUE INDEX ux_training_legacy_evidence_open ON training_legacy_evidence (revision_id) WHERE status IN ('SUBMITTED', 'VERIFIED', 'FILED');
DROP INDEX IF EXISTS ux_training_legacy_evidence_activity;
CREATE UNIQUE INDEX ux_training_legacy_evidence_activity ON training_legacy_evidence (activity_id) WHERE activity_id IS NOT NULL AND status IN ('SUBMITTED', 'VERIFIED', 'FILED');

-- the assignments to verify that nobody can do any more
UPDATE training_approval_assignments SET status = 'CANCELLED' WHERE object_type = 'TRAINING_LEGACY_EVIDENCE' AND status = 'PENDING';

-- the evidence that waited for a verifier is filed (the guard allows a change only while the status is SUBMITTED)
UPDATE training_legacy_evidence SET status = 'FILED' WHERE status = 'SUBMITTED';

-- the records of the persons named with that evidence (same rule as the service: one record for each person, activity, document and revision)
INSERT INTO training_records(id, person_user_id, activity_id, training_number, topic_text, document_number, document_revision, completed_on, method, result, source,
                             employee_code, full_name, department, position, content_sha256)
SELECT gen_random_uuid(), u.id, a.id, a.training_number, coalesce(nullif(btrim(a.paper_topic), ''), d.document_name), d.document_number, r.revision_number, r.training_completion_date,
       'PAPER', 'ATTENDED', 'LEGACY_IMPORT', u.employee_code, u.full_name, u.department, u.position,
       encode(sha256(convert_to(a.training_number || '|' || u.id || '|' || d.document_number || '|' || r.revision_number || '|' || r.training_completion_date || '|LEGACY_IMPORT', 'UTF8')), 'hex')
  FROM training_legacy_people p JOIN training_legacy_evidence e ON e.id = p.evidence_id AND e.status = 'FILED'
  JOIN training_activities a ON a.id = p.activity_id JOIN document_revisions r ON r.training_activity_id = a.id
  JOIN documents d ON d.id = r.document_id JOIN app_users u ON u.id = p.person_user_id
 WHERE p.role = 'TRAINEE' AND r.training_completion_date IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM training_records x WHERE x.person_user_id = u.id AND x.activity_id = a.id AND x.document_number = d.document_number
                      AND x.document_revision = r.revision_number AND x.source = 'LEGACY_IMPORT');

INSERT INTO training_records(id, person_user_id, activity_id, training_number, topic_text, document_number, document_revision, completed_on, method, result, source,
                             employee_code, full_name, department, position, content_sha256)
SELECT gen_random_uuid(), u.id, a.id, a.training_number, coalesce(nullif(btrim(a.paper_topic), ''), d.document_name), d.document_number, r.revision_number, r.training_completion_date,
       'SIGNATORY', 'READ', 'LEGACY_IMPORT', u.employee_code, u.full_name, u.department, u.position,
       encode(sha256(convert_to(a.training_number || '|' || u.id || '|' || d.document_number || '|' || r.revision_number || '|' || r.training_completion_date || '|LEGACY_SIGNATORY', 'UTF8')), 'hex')
  FROM training_legacy_people p JOIN training_legacy_evidence e ON e.id = p.evidence_id AND e.status = 'FILED'
  JOIN training_activities a ON a.id = p.activity_id JOIN document_revisions r ON r.id = p.revision_id
  JOIN documents d ON d.id = r.document_id JOIN app_users u ON u.id = p.person_user_id
 WHERE p.role = 'SIGNATORY' AND r.training_completion_date IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM training_records x WHERE x.person_user_id = u.id AND x.activity_id = a.id AND x.document_number = d.document_number
                      AND x.document_revision = r.revision_number AND x.source = 'LEGACY_IMPORT');
