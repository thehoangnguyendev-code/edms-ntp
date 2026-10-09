-- System announcements: banners an administrator schedules (start/end) and every user sees after signing in until
-- they close it, for example a maintenance notice. Not a GMP record, but each change is written to the audit trail.
CREATE TABLE system_announcements (
    id          UUID PRIMARY KEY,
    title       VARCHAR(150) NOT NULL,
    message     TEXT NOT NULL,
    severity    VARCHAR(20) NOT NULL,
    starts_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    version     BIGINT NOT NULL DEFAULT 0,
    created_by  VARCHAR(100),
    updated_by  VARCHAR(100),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_system_announcements_window CHECK (ends_at > starts_at),
    CONSTRAINT chk_system_announcements_severity CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL'))
);

CREATE INDEX idx_system_announcements_window ON system_announcements (enabled, starts_at, ends_at);

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'settings.announcement.view', 'View System Announcements', 'Application Settings', 'app-settings',
     'system_announcements', 'View the banner announcements shown to users after sign-in.', 1930, FALSE),
    (gen_random_uuid(), 'settings.announcement.manage', 'Manage System Announcements', 'Application Settings', 'app-settings',
     'system_announcements', 'Create, edit, schedule and delete the banner announcements shown to users after sign-in.', 1931, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES
    ('settings.announcement.manage', 'settings.announcement.view', 'REQUIRES', 'SET-ANN-1',
     'Managing announcements needs the view counterpart on the same resource.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;

-- System Administration is the scope that configures the system (same grant pattern as backup.module.view in V485).
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('settings.announcement.view', 'settings.announcement.manage')
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
