-- REPORT-OUTPUT-PREVIEW-2026-11-16: the file shown at the Output step of Create Report when the format is CSV or XLSX (read-only OnlyOffice viewer).
-- It is a working copy, not a report: kept only until the report the person is making is complete (then removed), or until it expires. No Audit Trail entry
-- (owner decision). It is not in the report storage: that one cannot delete (WORM), and a working copy must be deleted.
CREATE TABLE IF NOT EXISTS report_preview_files (
    id              uuid PRIMARY KEY,
    user_id         uuid        NOT NULL,
    definition_code varchar(100) NOT NULL,
    format          varchar(10)  NOT NULL,
    file_name       varchar(300) NOT NULL,
    sha256          varchar(64)  NOT NULL,
    byte_size       bigint       NOT NULL,
    content         bytea        NOT NULL,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    expires_at      timestamptz  NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_report_preview_files_owner ON report_preview_files (user_id, definition_code, format);
CREATE INDEX IF NOT EXISTS idx_report_preview_files_expires ON report_preview_files (expires_at);
COMMENT ON TABLE report_preview_files IS 'Working copies shown before a report is requested. Deleted when the report is complete or when they expire.';
