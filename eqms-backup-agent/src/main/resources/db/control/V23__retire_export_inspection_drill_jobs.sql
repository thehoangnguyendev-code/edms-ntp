-- The export, inspection and drill features were removed (decision of 2026-11-10). Their tables and records stay as evidence; no code reads
-- or writes them. The old job kinds stay allowed only because finished jobs of those kinds are still in the table.
ALTER TABLE backup_job DROP CONSTRAINT backup_job_job_type_check;
ALTER TABLE backup_job ADD CONSTRAINT backup_job_job_type_check CHECK (job_type IN
    ('BACKUP_DB', 'VERIFY', 'REHEARSAL', 'RESTORE_KEEP', 'RESTORE_PRODUCTION', 'RESTORE_FINALIZE', 'RESTORE_ROLLBACK',
     'EXPORT', 'INSPECTION'));
