-- How far a running job has got (0-100), reported by the agent while it works. A screen shows it as it is; it is never estimated.
ALTER TABLE backup_job ADD COLUMN progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100);
