-- Effective Access Diagnosis feature removed. Drop its permission catalog entry;
-- role_permissions/permission_set_items grants cascade-delete automatically.
DELETE FROM permissions WHERE code = 'security.effective_access.diagnose';
