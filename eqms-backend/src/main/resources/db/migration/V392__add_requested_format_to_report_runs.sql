-- V359 (create_report_platform) was, at some point after being applied, edited in place to add a
-- requested_format column to report_runs directly in its CREATE TABLE statement -- this is the exact
-- cause of the checksum drift documented in DC-XF-88 (Flyway checksum mismatch for version 359).
-- Editing an already-applied migration is never safe: every environment that already ran V359 never
-- actually got this column, since Flyway does not re-run applied migrations. V359 has been reverted
-- to its original (already-applied) content; this forward migration adds the column the correct way,
-- mirroring the same pattern V360 already used to add requested_format to report_schedules.
ALTER TABLE report_runs
    ADD COLUMN IF NOT EXISTS requested_format VARCHAR(12) NOT NULL DEFAULT 'CSV';

ALTER TABLE report_runs
    ADD CONSTRAINT ck_report_run_format CHECK (requested_format IN ('PDF', 'XLSX', 'CSV'));
