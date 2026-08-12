CREATE TABLE IF NOT EXISTS audit_log_changes (
    id UUID PRIMARY KEY,
    audit_log_id UUID NOT NULL REFERENCES audit_logs(id) ON DELETE CASCADE,
    field_name VARCHAR(120) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_changes_audit_log
    ON audit_log_changes(audit_log_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_changes_field_name
    ON audit_log_changes(field_name);
