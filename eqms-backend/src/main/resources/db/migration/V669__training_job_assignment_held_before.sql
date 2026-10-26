-- APD.0024 (a person can hold several Job Roles): the form of a change or an additional assignment lists ALL the Job Roles the person held before and ALL they hold after.
-- The set held before is written when the draft is made (id, name, department of each role), so the form of a signed assignment never changes afterwards.
ALTER TABLE training_job_assignments ADD COLUMN IF NOT EXISTS held_before JSONB;
