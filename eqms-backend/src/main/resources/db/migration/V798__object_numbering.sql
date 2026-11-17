-- AUDIT-OBJECT-REGISTRY (2026-11-17, owner decision): records that had only a name get a real number whose format an administrator sets in
-- System Administration > Object Numbering. One row of format per kind, one counter row per kind and period (the year, or '' when the format has no year).
-- The numbers are given by ObjectNumberService; this migration only creates the columns and the default formats (the owner's defaults of 2026-11-17).
-- Existing records are numbered by ObjectNumberBackfill at start-up, in the order they were created, with an audit entry per kind (D6).
-- Forward-only, idempotent.
CREATE TABLE IF NOT EXISTS object_number_formats (
    kind         VARCHAR(60)  PRIMARY KEY,
    module_name  VARCHAR(60)  NOT NULL,
    label        VARCHAR(120) NOT NULL,
    prefix       VARCHAR(20)  NOT NULL,
    separator    VARCHAR(3)   NOT NULL DEFAULT '-',
    include_year BOOLEAN      NOT NULL,
    digits       INT          NOT NULL CHECK (digits BETWEEN 3 AND 10),
    version      INT          NOT NULL DEFAULT 1,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by   UUID
);

CREATE TABLE IF NOT EXISTS object_number_counters (
    kind       VARCHAR(60) NOT NULL REFERENCES object_number_formats(kind),
    period     VARCHAR(4)  NOT NULL,
    last_value BIGINT      NOT NULL CHECK (last_value >= 0),
    PRIMARY KEY (kind, period)
);

INSERT INTO object_number_formats (kind, module_name, label, prefix, separator, include_year, digits) VALUES
    ('SCHEDULED_REPORT',      'Reports',                  'Scheduled Report Number',       'SRP', '-', TRUE,  5),
    ('AUDIT_TRAIL_CAMPAIGN',  'Audit Trail',              'Audit Trail Campaign Number',   'ATC', '-', TRUE,  4),
    ('ACCESS_REVIEW_CAMPAIGN','Security & Authorization', 'Access Review Campaign Number', 'ARC', '-', TRUE,  4),
    ('OBJECT_ACCESS_RULE',    'Security & Authorization', 'Object Access Rule Number',     'OAR', '-', FALSE, 5),
    ('BACKUP_ALERT',          'Backup & Restore',         'Backup Alert Number',           'BAL', '-', TRUE,  5),
    ('ANNOUNCEMENT',          'Application Settings',     'Announcement Number',           'ANN', '-', TRUE,  4)
ON CONFLICT (kind) DO NOTHING;

ALTER TABLE report_schedules              ADD COLUMN IF NOT EXISTS schedule_number     VARCHAR(40);
ALTER TABLE audit_trail_review_campaigns  ADD COLUMN IF NOT EXISTS campaign_number     VARCHAR(40);
ALTER TABLE access_review_campaigns       ADD COLUMN IF NOT EXISTS campaign_number     VARCHAR(40);
ALTER TABLE object_access_rules           ADD COLUMN IF NOT EXISTS rule_number         VARCHAR(40);
ALTER TABLE system_announcements          ADD COLUMN IF NOT EXISTS announcement_number VARCHAR(40);

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_schedules_number     ON report_schedules(schedule_number)             WHERE schedule_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_trail_campaign_number ON audit_trail_review_campaigns(campaign_number) WHERE campaign_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_access_review_campaign_number ON access_review_campaigns(campaign_number)    WHERE campaign_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_object_access_rules_number  ON object_access_rules(rule_number)             WHERE rule_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_announcements_number ON system_announcements(announcement_number)    WHERE announcement_number IS NOT NULL;

-- A backup alert lives in the backup agent's own database; its number is kept here, one row per alert id, given the first time this system sees the alert.
CREATE TABLE IF NOT EXISTS backup_alert_numbers (
    alert_id     VARCHAR(80) PRIMARY KEY,
    alert_number VARCHAR(40) NOT NULL UNIQUE,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'settings.object_numbering.view', 'View Object Numbering', 'System Settings', 'settings', 'system_settings',
       'See the format of the numbers that records (scheduled reports, campaigns, announcements...) are given.', 960, FALSE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'settings.object_numbering.view');
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'settings.object_numbering.manage', 'Manage Object Numbering', 'System Settings', 'settings', 'system_settings',
       'Change the format of the numbers given to new records. A number already given never changes. Each change is recorded in the Audit Trail with its reason.', 961, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'settings.object_numbering.manage');
