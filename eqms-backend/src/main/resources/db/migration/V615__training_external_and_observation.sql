-- WP-OBS and WP-EXT (PLAN-TR-001 17.2, 17.4).
-- 1. Practical training may be assessed by observing the actual operations (SOP.0003 5.1.2); it is recorded with the checklist of APD.0009 (D-42).
-- 2. External training has no method or assessment of its own, a training unit, and a certificate as evidence; its record result is ATTENDED when there is no score (D-43).
-- 3. A person who confirmed the self-reading has the day of the reading on the row (APD.0108).

ALTER TABLE training_sessions ALTER COLUMN method DROP NOT NULL;
ALTER TABLE training_sessions ALTER COLUMN assessment_method DROP NOT NULL;
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS training_sessions_assessment_method_check;
ALTER TABLE training_sessions ADD CONSTRAINT training_sessions_assessment_method_check
    CHECK (assessment_method IS NULL OR assessment_method IN ('TEST', 'CHECKLIST', 'OBSERVATION', 'SELF_READING_CONFIRMATION'));

ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS training_unit_name VARCHAR(255);
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS vendor_ref VARCHAR(120);

ALTER TABLE training_paper_evidence DROP CONSTRAINT IF EXISTS training_paper_evidence_kind_check;
ALTER TABLE training_paper_evidence ADD CONSTRAINT training_paper_evidence_kind_check
    CHECK (kind IN ('ATTENDANCE_SHEET', 'ASSESSMENT', 'CERTIFICATE', 'OTHER'));

ALTER TABLE training_records DROP CONSTRAINT IF EXISTS training_records_result_check;
ALTER TABLE training_records ADD CONSTRAINT training_records_result_check CHECK (result IN ('PASSED', 'READ', 'ATTENDED'));

ALTER TABLE training_participants ADD COLUMN IF NOT EXISTS read_confirmed_at TIMESTAMPTZ;
