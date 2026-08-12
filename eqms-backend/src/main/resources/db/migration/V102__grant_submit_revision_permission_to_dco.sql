INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'SUBMIT_REVISION'
WHERE UPPER(r.name) = 'DCO'
ON CONFLICT DO NOTHING;
