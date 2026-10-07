-- Retirement does not delete artifacts, scopes, snapshots or audit evidence.
ALTER TABLE report_definitions ADD COLUMN deleted_at timestamptz;
ALTER TABLE report_definitions ADD COLUMN deleted_by_user_id uuid REFERENCES app_users(id);
CREATE INDEX idx_report_templates_live ON report_definitions(display_name,code)
    WHERE source_code IS NOT NULL AND deleted_at IS NULL;
