ALTER TABLE report_schedules
    ADD COLUMN IF NOT EXISTS requested_format VARCHAR(12) NOT NULL DEFAULT 'CSV';

ALTER TABLE report_schedules
    ADD CONSTRAINT ck_report_schedule_format CHECK (requested_format IN ('PDF', 'XLSX', 'CSV'));
