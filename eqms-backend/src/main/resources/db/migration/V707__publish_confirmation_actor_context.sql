ALTER TABLE publishing_job_commands
    ADD COLUMN confirmation_context JSONB NOT NULL DEFAULT '{}'::jsonb;
