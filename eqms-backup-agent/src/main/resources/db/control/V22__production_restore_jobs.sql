-- The restore into production (SDS-BR-003) is run by the restore worker as three kinds of job.
ALTER TABLE backup_job DROP CONSTRAINT backup_job_job_type_check;
ALTER TABLE backup_job ADD CONSTRAINT backup_job_job_type_check CHECK (job_type IN
    ('BACKUP_DB', 'VERIFY', 'EXPORT', 'REHEARSAL', 'INSPECTION', 'RESTORE_KEEP', 'RESTORE_PRODUCTION', 'RESTORE_FINALIZE', 'RESTORE_ROLLBACK'));
