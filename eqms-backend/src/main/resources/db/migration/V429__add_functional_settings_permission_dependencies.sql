-- Each manage permission requires the matching read permission for its own screen.
INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale)
VALUES
    ('settings.business_unit.manage', 'settings.business_unit.view', 'REQUIRES', 'SET-10', 'Quản lý Business Units cần xem được cùng resource.'),
    ('settings.department.manage', 'settings.department.view', 'REQUIRES', 'SET-11', 'Quản lý Departments cần xem được cùng resource.'),
    ('settings.position.manage', 'settings.position.view', 'REQUIRES', 'SET-12', 'Quản lý Positions cần xem được cùng resource.'),
    ('settings.storage_location.manage', 'settings.storage_location.view', 'REQUIRES', 'SET-13', 'Quản lý Storage Locations cần xem được cùng resource.'),
    ('settings.retention_policy.manage', 'settings.retention_policy.view', 'REQUIRES', 'SET-14', 'Quản lý Retention Policies cần xem được cùng resource.'),
    ('settings.country.manage', 'settings.country.view', 'REQUIRES', 'SET-15', 'Quản lý Countries cần xem được cùng resource.'),
    ('settings.education.degree_level.manage', 'settings.education.degree_level.view', 'REQUIRES', 'SET-16', 'Quản lý Education Degree Levels cần xem được cùng resource.'),
    ('settings.education.school.manage', 'settings.education.school.view', 'REQUIRES', 'SET-17', 'Quản lý Education Schools cần xem được cùng resource.')
ON CONFLICT (permission_code, depends_on_code, relation_type) WHERE depends_on_code IS NOT NULL DO NOTHING;
