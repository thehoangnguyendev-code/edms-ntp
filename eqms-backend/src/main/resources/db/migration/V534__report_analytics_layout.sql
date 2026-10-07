-- Preserve historic snapshots/artifacts. JSON additions are optional for old layouts.
ALTER TABLE report_runs ADD COLUMN report_title varchar(255);
CREATE INDEX idx_report_runs_title ON report_runs(report_title);
ALTER TABLE report_schedules ADD COLUMN version integer NOT NULL DEFAULT 1;
