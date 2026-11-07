-- Same catalog placement as the other Object Access Rules permissions (security.object_rules.view / .manage).
UPDATE permissions
SET category = 'Object Access Rules',
    module_key = 'security-authorization',
    group_key = 'object_access',
    display_order = 1833
WHERE code = 'security.object_rules.manage_own_department';
