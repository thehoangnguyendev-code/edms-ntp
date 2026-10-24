-- Training Assessments: the statuses are Draft, Pending Approval and Effective (the older version of a code, when a new one becomes Effective, is Replaced).
-- The designer submits a draft for approval; the approver signs it into Effective, or returns it to Draft with a reason. A checklist has no score.
ALTER TABLE training_assessment_defs DROP CONSTRAINT IF EXISTS ck_training_assessment_status;
UPDATE training_assessment_defs SET status = 'EFFECTIVE' WHERE status = 'APPROVED';
ALTER TABLE training_assessment_defs ADD CONSTRAINT ck_training_assessment_status CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'EFFECTIVE', 'SUPERSEDED'));
ALTER TABLE training_assessment_defs ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES app_users(id);
ALTER TABLE training_assessment_defs ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- one version being prepared at a time for a code: a draft or one waiting for approval
DROP INDEX IF EXISTS ux_training_assessment_one_draft;
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_assessment_one_open ON training_assessment_defs (code) WHERE status IN ('DRAFT', 'PENDING_APPROVAL');

-- a checklist has no score: its total is not kept
UPDATE training_activities SET assessment_max_score = NULL WHERE assessment_kind = 'CHECKLIST';
