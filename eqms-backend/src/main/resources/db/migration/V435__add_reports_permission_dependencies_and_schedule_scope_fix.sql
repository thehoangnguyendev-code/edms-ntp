-- reports.definition.manage / reports.schedule.manage were seeded (V359) without a matching
-- REQUIRES row tying them to their .view counterpart, unlike every other *.manage permission in
-- the catalog. ReportPlatformService.updateConfiguration()/updateFields() already assume the
-- caller also holds reports.definition.view (they call configurationDetail() internally, which
-- requires it) -- without this dependency, an Access Profile could grant .manage alone and the
-- actor would hit a mid-transaction SecurityException on their own save.
INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES
    ('reports.definition.manage', 'reports.definition.view', 'REQUIRES', 'RPT-01', 'Quản lý Report Definitions cần xem được cùng resource.'),
    ('reports.schedule.manage', 'reports.schedule.view', 'REQUIRES', 'RPT-02', 'Quản lý Report Schedules cần xem được cùng resource.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;
