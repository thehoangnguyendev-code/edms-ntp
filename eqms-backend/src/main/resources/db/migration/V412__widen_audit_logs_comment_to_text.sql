-- audit_logs.comment was varchar(1024). A workflow reason exceeding 1024 characters made the audit
-- INSERT fail: for the throwing log()/logAs() variants that rolled back the whole business
-- transaction; for logSafely() the audit row was silently dropped. Neither is acceptable for a GMP
-- audit trail, and there is no business reason to cap a free-text reason at 1024. reason /
-- old_value / new_value are already TEXT; align comment with them. varchar -> text in PostgreSQL is
-- a metadata-only change (no table rewrite, no data loss).
-- Decision Log: agreed with QA to remove the incidental 1024 limit on the workflow reason.
ALTER TABLE audit_logs ALTER COLUMN comment TYPE text;
