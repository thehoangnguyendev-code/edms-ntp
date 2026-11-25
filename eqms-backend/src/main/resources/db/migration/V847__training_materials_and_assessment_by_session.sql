-- Owner decision 2026-11-24 (DEC-TRAINING-2026-11-24-1, PLAN-TR-005): the training materials and the assessment (the test or the checklist) of an activity belong to a SESSION,
-- or to all its sessions. A material whose session is empty is shared by every session (all the rows that exist before this migration are shared, so nothing changes for them).
-- The assessment chosen from the library is kept for each session in its own row; the columns of the activity stay as the last choice, for the reports.
-- Forward-only and idempotent. Rollback (if needed): drop the table training_session_assessments and the column training_materials.session_id.
ALTER TABLE training_materials ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES training_sessions(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ix_training_materials_session ON training_materials (session_id) WHERE session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS training_session_assessments (
    session_id        UUID PRIMARY KEY REFERENCES training_sessions(id) ON DELETE RESTRICT,
    assessment_def_id UUID NOT NULL REFERENCES training_assessment_defs(id),
    def_code          VARCHAR(40) NOT NULL,
    def_version       INTEGER NOT NULL,
    def_revision      VARCHAR(20),
    name              VARCHAR(255),
    kind              VARCHAR(12),
    max_score         NUMERIC,
    chosen_by         UUID REFERENCES app_users(id),
    chosen_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
