-- Training Assessments: the Code column is split into the Assessment Number (code, unchanged) and the Assessment Revision, which is managed as the revision of a document of Document Control:
--   a draft is numbered (effective major).0.(patch + 1)  -> a first draft is 0.0.1, a new draft of 1.0.0 is 1.0.1;
--   approving it makes it the next major                  -> 0.0.1 becomes 1.0.0, 1.0.1 becomes 2.0.0.
-- version_no stays as the internal order of the revisions of a number; the revision is what people read. The Title is renamed Assessment Name (also on the activity that chose it).
ALTER TABLE training_assessment_defs ADD COLUMN IF NOT EXISTS revision_number VARCHAR(20);
UPDATE training_assessment_defs
   SET revision_number = CASE WHEN status IN ('DRAFT', 'PENDING_APPROVAL') THEN (version_no - 1) || '.0.1' ELSE version_no || '.0.0' END
 WHERE revision_number IS NULL;
ALTER TABLE training_assessment_defs ALTER COLUMN revision_number SET NOT NULL;
ALTER TABLE training_assessment_defs DROP CONSTRAINT IF EXISTS ck_training_assessment_revision;
ALTER TABLE training_assessment_defs ADD CONSTRAINT ck_training_assessment_revision CHECK (revision_number ~ '^[0-9]+\.0\.[0-9]+$');
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_assessment_code_revision ON training_assessment_defs (code, revision_number);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_assessment_defs' AND column_name = 'title') THEN
        ALTER TABLE training_assessment_defs RENAME COLUMN title TO name;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_activities' AND column_name = 'assessment_title') THEN
        ALTER TABLE training_activities RENAME COLUMN assessment_title TO assessment_name;
    END IF;
END $$;

ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS assessment_def_revision VARCHAR(20);
UPDATE training_activities a SET assessment_def_revision = d.revision_number
  FROM training_assessment_defs d WHERE d.id = a.assessment_def_id AND a.assessment_def_revision IS NULL;
