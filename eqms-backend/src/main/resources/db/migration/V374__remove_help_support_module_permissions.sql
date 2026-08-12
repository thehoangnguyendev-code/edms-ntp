-- Retire the removed Help & Support feature and its User Manual child module.
-- Permission rows are no longer referenced by application code. Remove grants first
-- so existing installations do not retain dead capabilities in access profiles.

DELETE FROM permission_set_items
WHERE permission_id IN (
    SELECT id
    FROM permissions
    WHERE code IN ('help_support.module.view', 'user_manual.module.view')
);

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id
    FROM permissions
    WHERE code IN ('help_support.module.view', 'user_manual.module.view')
);

DELETE FROM permissions
WHERE code IN ('help_support.module.view', 'user_manual.module.view');
