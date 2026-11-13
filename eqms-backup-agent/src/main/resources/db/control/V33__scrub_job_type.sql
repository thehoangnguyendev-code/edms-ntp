-- The periodic check of the live file store runs as a job of its own kind.
ALTER TABLE backup_job DROP CONSTRAINT backup_job_job_type_check;
ALTER TABLE backup_job ADD CONSTRAINT backup_job_job_type_check CHECK (job_type IN
    ('BACKUP_DB', 'VERIFY', 'REHEARSAL', 'RESTORE_KEEP', 'RESTORE_PRODUCTION', 'RESTORE_FINALIZE', 'RESTORE_ROLLBACK',
     'EXPORT', 'INSPECTION', 'SCRUB'));
