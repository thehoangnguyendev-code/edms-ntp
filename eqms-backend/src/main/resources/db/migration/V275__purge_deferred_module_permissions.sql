-- V274 removed the initial view-permission catalog entries. Some later
-- security migrations added action-level permissions for the same deferred
-- modules, so remove them by canonical module key as well. Foreign keys on
-- role and permission-set assignments cascade these deletions safely.

DELETE FROM permissions
WHERE module_key IN (
    'deviations',
    'capa',
    'change-control',
    'complaints',
    'risk-management',
    'equipment',
    'supplier',
    'product',
    'regulatory'
);
