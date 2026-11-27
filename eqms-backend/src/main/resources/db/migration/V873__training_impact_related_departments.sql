-- DEC-TRAINING-2026-11-27-01 (A3): SOP.0003 5.3.1 asks the responsible department AND the related departments to assess the training impact of a new document on
-- their matrix. The department that owns the document names the related ones when it assesses; each of them gets its own line and its own signed assessment.
CREATE TABLE IF NOT EXISTS training_impact_departments (
    activity_id   uuid NOT NULL REFERENCES training_activities(id),
    department_id uuid NOT NULL REFERENCES departments(id),
    added_by      uuid NOT NULL REFERENCES app_users(id),
    added_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (activity_id, department_id)
);
CREATE INDEX IF NOT EXISTS ix_training_impact_departments_department ON training_impact_departments (department_id);

-- which department an assessment is of; an assessment made before this change is of the department that owns the document (assessments are never updated)
ALTER TABLE training_impact_assessments ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id);
